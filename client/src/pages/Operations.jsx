import { useState, useRef, useEffect } from 'react';
import { submitTransaction, getItemDetails, getBom, submitBomTransaction } from '../api';
import { Scan, ArrowDownToLine, ArrowUpFromLine, CheckCircle, AlertTriangle, Package, Layers } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const Operations = () => {
    const [mode, setMode] = useState(() => {
        return sessionStorage.getItem('wms_ops_mode') || 'IN';
    }); // IN or OUT or BOM_OUT
    const [barcode, setBarcode] = useState('');
    const [locationCode, setLocationCode] = useState('');
    const [quantity, setQuantity] = useState('');
    const [itemInfo, setItemInfo] = useState(null);
    const [bomInfo, setBomInfo] = useState(() => {
        const saved = sessionStorage.getItem('wms_ops_bomInfo');
        return saved ? JSON.parse(saved) : null;
    }); // For BOM Outbound setup
    const [bomOutData, setBomOutData] = useState(() => {
        const saved = sessionStorage.getItem('wms_ops_bomOutData');
        return saved ? JSON.parse(saved) : {
            isActive: false,
            mainBarcode: '',
            sets: 1,
            components: [] // { component_barcode, required_total, picked_total, current_stock }
        };
    });

    useEffect(() => {
        sessionStorage.setItem('wms_ops_mode', mode);
    }, [mode]);

    useEffect(() => {
        if (bomInfo) {
            sessionStorage.setItem('wms_ops_bomInfo', JSON.stringify(bomInfo));
        } else {
            sessionStorage.removeItem('wms_ops_bomInfo');
        }
    }, [bomInfo]);

    useEffect(() => {
        sessionStorage.setItem('wms_ops_bomOutData', JSON.stringify(bomOutData));
    }, [bomOutData]);

    useEffect(() => {
        if (mode === 'BOM_OUT' && bomOutData.isActive && barcode) {
            const comp = bomOutData.components.find(c => c.component_barcode === barcode);
            if (comp) {
                const remaining = Math.max(0, comp.required_total - comp.picked_total);
                if (remaining > 0) {
                    setQuantity(remaining.toString());
                }
            }
        }
    }, [barcode, mode, bomOutData.isActive, bomOutData.components]);

    // Cleanup and Focus Management
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    const barcodeInputRef = useRef(null);

    useEffect(() => {
        if (barcode) {
            if (mode === 'BOM_OUT') {
                fetchBomInfo();
            } else {
                fetchItemInfo();
            }
        } else {
            setItemInfo(null);
            setBomInfo(null);
        }
    }, [barcode, mode]);

    const fetchItemInfo = async () => {
        try {
            const res = await getItemDetails(barcode);
            setItemInfo(res.data);
        } catch (e) {
            setItemInfo(null);
        }
    };

    const fetchBomInfo = async () => {
        try {
            const res = await getBom(barcode);
            if (res.data && res.data.length > 0) {
                // Exact match or first match
                const matched = res.data.find(b => b.main_barcode === barcode) || res.data[0];
                setBomInfo(matched);
            } else {
                setBomInfo(null);
            }
        } catch (e) {
            setBomInfo(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');

            if (mode === 'BOM_OUT' && bomOutData.isActive) {
                // Local staging only
                const bcode = barcode.trim();
                const lcode = locationCode.trim();
                const qty = parseFloat(quantity);

                // Optional: Check if part of BOM locally (prevent accidental scans)
                if (!bomOutData.components.find(c => c.component_barcode === bcode)) {
                    setMessage({ type: 'error', text: '此元件不屬於當前主件的配方!' });
                    setLoading(false);
                    return;
                }

                setBomOutData(prev => {
                    const newComps = prev.components.map(comp => {
                        if (comp.component_barcode === bcode) {
                            return { ...comp, picked_total: comp.picked_total + qty };
                        }
                        return comp;
                    });

                    const newPicks = [...(prev.staged_picks || []), { barcode: bcode, location_code: lcode, quantity: qty }];
                    return { ...prev, components: newComps, staged_picks: newPicks };
                });

                setMessage({ type: 'success', text: `已暫存元件! (${bcode})` });
            } else {
                // Standard IN/OUT or NO_STICKER_IN
                // Map NO_STICKER_IN to standard IN for the backend API
                const apiMode = mode === 'NO_STICKER_IN' ? 'IN' : mode;
                const res = await submitTransaction({
                    type: apiMode,
                    barcode: barcode.trim(),
                    location_code: locationCode.trim(),
                    quantity: parseFloat(quantity)
                }, token);
                setMessage({ type: 'success', text: `成功入庫! 最新數量: ${res.data.newQty}` });
            }

            setBarcode('');
            setLocationCode('');
            setQuantity('');
            setItemInfo(null);
            barcodeInputRef.current?.focus();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || '操作失敗' });
        } finally {
            setLoading(false);
        }
    };

    const handleStartBom = () => {
        if (!bomInfo || !quantity || quantity <= 0) return;
        setBomOutData({
            isActive: true,
            mainBarcode: bomInfo.main_barcode,
            sets: parseInt(quantity),
            staged_picks: [],
            components: bomInfo.components.map(c => ({
                component_barcode: c.component_barcode,
                component_name: c.component_name,
                required_total: c.required_qty * parseInt(quantity),
                picked_total: 0,
                current_stock: c.current_stock,
                locations: c.locations
            }))
        });
        setBarcode('');
        setLocationCode('');
        setQuantity('');
        setMessage({ type: 'success', text: '主件選取完成，請開始逐一掃描出庫元件' });
    };

    const handleCancelBom = () => {
        setBomOutData({ isActive: false, mainBarcode: '', sets: 1, components: [], staged_picks: [] });
        setBomInfo(null);
        setBarcode('');
        setLocationCode('');
        setQuantity('');
        setMessage(null);
    };

    const handleSkipComponent = (component_barcode) => {
        if (!window.confirm(`確定要將元件 ${component_barcode} 標記為不需取料嗎？\n(進度將直接滿額，但本次出庫不會扣除也不會紀錄該元件)`)) return;
        setBomOutData(prev => {
            const newComps = prev.components.map(comp => {
                if (comp.component_barcode === component_barcode) {
                    return { ...comp, picked_total: comp.required_total }; // Artificially mark as done
                }
                return comp;
            });
            return { ...prev, components: newComps };
        });
        setMessage({ type: 'success', text: `已略過元件: ${component_barcode}` });
    };

    const handleConfirmBom = async () => {
        const allDone = bomOutData.components.every(c => c.picked_total >= c.required_total);
        if (!allDone) {
            if (!window.confirm("尚有元件數量不足或未掃描，確定要直接出貨 (僅扣除已掃描數量) 嗎？")) return;
        }

        if (!bomOutData.staged_picks || bomOutData.staged_picks.length === 0) {
            if (!window.confirm("尚未掃描任何出庫元件 (本次扣帳數量為0)，確定要結束此主件作業嗎？")) return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await submitBomTransaction({
                main_barcode: bomOutData.mainBarcode,
                sets: bomOutData.sets,
                staged_picks: bomOutData.staged_picks
            }, token);

            setMessage({ type: 'success', text: `主件 ${bomOutData.mainBarcode} 批次出庫成功! 共處理 ${res.data.processedComponents} 筆` });
            setBomOutData({ isActive: false, mainBarcode: '', sets: 1, components: [], staged_picks: [] });
            setBomInfo(null);
            setBarcode('');
            setLocationCode('');
            setQuantity('');
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || '批次出庫失敗' });
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSticker = () => {
        if (!itemInfo) return;
        window.print();
        setMessage({ type: 'success', text: '貼紙列印對話框已開啟' });
    };

    return (
        <div className="space-y-8 transition-all duration-300 w-full">
            <header className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">出入庫作業</h2>
                <div className="flex justify-center gap-4 bg-gray-800 p-1 rounded-lg inline-flex">
                    <button
                        onClick={() => setMode('IN')}
                        className={clsx(
                            "px-6 py-2 rounded-md font-bold transition-all flex items-center gap-2",
                            mode === 'IN' ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                        )}
                    >
                        <ArrowDownToLine size={18} /> 入庫 (Inbound)
                    </button>
                    <button
                        onClick={() => { setMode('NO_STICKER_IN'); setBarcode(''); }}
                        className={clsx(
                            "px-6 py-2 rounded-md font-bold transition-all flex items-center gap-2",
                            mode === 'NO_STICKER_IN' ? "bg-teal-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                        )}
                    >
                        <ArrowDownToLine size={18} /> 無貼紙入庫 (No-Sticker IN)
                    </button>
                    <button
                        onClick={() => { setMode('OUT'); setBarcode(''); }}
                        className={clsx(
                            "px-6 py-2 rounded-md font-bold transition-all flex items-center gap-2",
                            mode === 'OUT' ? "bg-orange-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                        )}
                    >
                        <ArrowUpFromLine size={18} /> 出庫 (Outbound)
                    </button>
                    <button
                        onClick={() => { setMode('BOM_OUT'); setBarcode(''); }}
                        className={clsx(
                            "px-6 py-2 rounded-md font-bold transition-all flex items-center gap-2",
                            mode === 'BOM_OUT' ? "bg-yellow-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                        )}
                    >
                        <Layers size={18} /> 主件出庫 (BOM Out)
                    </button>
                </div>
            </header>

            <div className={clsx("grid gap-8 transition-all", mode === 'NO_STICKER_IN' ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1 md:grid-cols-2")}>
                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={clsx("bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl", mode === 'NO_STICKER_IN' ? "lg:col-span-5" : "")}
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {mode === 'BOM_OUT' && !bomOutData.isActive ? (
                            // Phase 1: Setup BOM
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        1. 掃描主件品號 (Main Barcode)
                                    </label>
                                    <div className="relative">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                        <input
                                            ref={barcodeInputRef}
                                            type="text"
                                            className="w-full bg-gray-700 border border-gray-600 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono placeholder-gray-500 transition-all focus:border-blue-500"
                                            placeholder="掃描 主件Barcode..."
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            autoFocus
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        2. 預計出庫套數 (Sets)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono font-bold placeholder-gray-500 transition-all focus:border-blue-500"
                                        placeholder="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min="1"
                                        required
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleStartBom}
                                    disabled={!bomInfo || !quantity}
                                    className="w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white"
                                >
                                    開始選取元件
                                </button>
                            </>
                        ) : (
                            // Standard IN/OUT or Phase 2: Pick Components
                            <>
                                {mode === 'BOM_OUT' && bomOutData.isActive && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-xl mb-4 text-yellow-400 flex justify-between items-center">
                                        <div>
                                            <span className="font-bold">目前作業主件：{bomOutData.mainBarcode}</span>
                                            <span className="ml-2 text-sm text-yellow-200">({bomOutData.sets} 套)</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handleConfirmBom} className="text-sm px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold transition-colors shadow-lg">確認主件出貨</button>
                                            <button type="button" onClick={handleCancelBom} className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors border border-gray-600">取消作業</button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        {mode === 'BOM_OUT' ? '1. 掃描元件條碼 (Component Barcode)' : '1. 掃描料件條碼 (Item Barcode)'}
                                    </label>
                                    <div className="relative">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                        <input
                                            ref={barcodeInputRef}
                                            type="text"
                                            className="w-full bg-gray-700 border border-gray-600 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono placeholder-gray-500 transition-all focus:border-blue-500"
                                            placeholder="掃描 Barcode..."
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    {mode !== 'BOM_OUT' && barcode && !itemInfo && !loading && (
                                        <p className="mt-2 text-sm text-red-400 font-bold bg-red-500/10 p-2 rounded border border-red-500/20">
                                            ⚠️ 總表內無此料件，無法作業！
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        2. 掃描儲位 QR Code (Location)
                                    </label>
                                    <div className="relative">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                        <input
                                            type="text"
                                            className="w-full bg-gray-700 border border-gray-600 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono placeholder-gray-500 transition-all focus:border-blue-500"
                                            placeholder="掃描 Location..."
                                            value={locationCode}
                                            onChange={(e) => setLocationCode(e.target.value)}
                                            required
                                            disabled={mode !== 'BOM_OUT' && !itemInfo}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        3. 輸入數量 (Quantity)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono font-bold placeholder-gray-500 transition-all focus:border-blue-500"
                                        placeholder="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min="0.001"
                                        step="any"
                                        required
                                        disabled={mode !== 'BOM_OUT' && !itemInfo}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || (mode !== 'BOM_OUT' && !itemInfo)}
                                    className={clsx(
                                        "w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                        mode === 'IN'
                                            ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white"
                                            : mode === 'NO_STICKER_IN'
                                                ? "bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white"
                                                : mode === 'OUT'
                                                    ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white"
                                                    : "bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white"
                                    )}
                                >
                                    {loading ? '處理中...' : (mode === 'IN' ? '確認入庫' : mode === 'NO_STICKER_IN' ? '確認入庫 (無貼紙)' : mode === 'OUT' ? '確認出庫' : '確認元件出庫')}
                                </button>
                            </>
                        )}
                    </form>

                    <AnimatePresence>
                        {message && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={clsx(
                                    "mt-4 p-4 rounded-xl flex items-center gap-3",
                                    message.type === 'success' ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                )}
                            >
                                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                <span className="font-medium">{message.text}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Info Panel */}
                <div className={clsx("space-y-6", mode === 'NO_STICKER_IN' ? "lg:col-span-7 grid grid-cols-1 md:grid-cols-2 md:gap-6 md:space-y-0" : "")}>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gray-800 p-6 rounded-2xl border border-gray-700 h-full"
                    >
                        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            {mode === 'BOM_OUT' ? <Layers className="text-yellow-400" /> : <Package className="text-blue-400" />}
                            {mode === 'BOM_OUT' ? '主件資訊' : '料件資訊'}
                        </h3>


                        {mode === 'BOM_OUT' ? (
                            bomOutData.isActive ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-700/50 rounded-xl mb-4">
                                        <span className="text-gray-400 text-xs uppercase tracking-wider">元件出庫進度 ({bomOutData.sets}套)</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {bomOutData.components.map((comp, idx) => {
                                            const isDone = comp.picked_total >= comp.required_total;
                                            const isWarning = comp.current_stock < comp.required_total;
                                            return (
                                                <li key={idx} className={clsx("border p-3 rounded-lg text-sm transition-colors", isDone ? "bg-green-500/10 border-green-500/30" : "bg-gray-900 border-gray-600")}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-mono text-blue-300">{comp.component_barcode}</span>
                                                        <span className="text-xs text-gray-500 truncate ml-2 text-right">{comp.component_name}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="flex flex-col">
                                                            <span className={clsx("text-xs", isWarning ? "text-red-400 font-bold" : "text-gray-400")}>總庫存: {comp.current_stock}</span>
                                                            <span className="text-xs text-gray-400 mt-1">儲位: {comp.locations || '無'}</span>
                                                            {comp.current_stock === 0 && !isDone && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSkipComponent(comp.component_barcode)}
                                                                    className="mt-2 text-xs bg-red-900/50 hover:bg-red-800 border border-red-700/50 text-red-200 px-2 py-1 rounded transition-colors w-fit"
                                                                >
                                                                    庫存為0，確認不需取料
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs text-gray-400">進度 </span>
                                                            <span className={clsx("font-bold text-lg", isDone ? "text-green-400" : "text-yellow-400")}>
                                                                {comp.picked_total}
                                                            </span>
                                                            <span className="text-gray-500"> / {comp.required_total}</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : bomInfo ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-700/50 rounded-xl">
                                        <span className="text-gray-400 text-xs uppercase tracking-wider">主件品號</span>
                                        <div className="text-lg font-bold text-yellow-400 font-mono">{bomInfo.main_barcode}</div>
                                    </div>

                                    <div>
                                        <span className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">所需元件 (庫存檢查)</span>
                                        <ul className="space-y-2">
                                            {bomInfo.components.map((comp, idx) => {
                                                const totalNeeded = comp.required_qty * (parseInt(quantity) || 1);
                                                const hasEnough = comp.current_stock >= totalNeeded;
                                                return (
                                                    <li key={idx} className="bg-gray-900 border border-gray-600 p-3 rounded-lg text-sm">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-mono text-blue-300">{comp.component_barcode}</span>
                                                            <span className={clsx("font-bold cursor-help", hasEnough ? "text-green-400" : "text-red-400")} title="即使不足仍可部分領取">
                                                                {comp.current_stock} / 需要 {totalNeeded}
                                                            </span>
                                                        </div>
                                                        <div className="text-gray-500 text-xs truncate">{comp.component_name}</div>
                                                        <div className="text-gray-400 text-xs mt-1">
                                                            儲位: {comp.locations || '無庫存'}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-10">
                                    <Scan size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>請掃描或輸入主件條碼</p>
                                </div>
                            )
                        ) : itemInfo ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-700/50 rounded-xl">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider">名稱</span>
                                    <div className="text-lg font-bold text-white">{itemInfo.item.name}</div>
                                </div>
                                <div className="p-4 bg-gray-700/50 rounded-xl">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider">規格/描述</span>
                                    <div className="text-gray-300">{itemInfo.item.description || '-'}</div>
                                </div>

                                <div>
                                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">目前庫存分佈</span>
                                    {itemInfo.inventory.length > 0 ? (
                                        <ul className="space-y-2">
                                            {itemInfo.inventory.map(inv => (
                                                <li key={inv.id} className="flex justify-between items-center bg-gray-900 border border-gray-600 p-3 rounded-lg">
                                                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm font-mono">{inv.location_code}</span>
                                                    <span className="text-green-400 font-bold">{inv.quantity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-gray-500 italic">此料件暫無庫存</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-10">
                                <Scan size={48} className="mx-auto mb-4 opacity-20" />
                                <p>請掃描或輸入料件條碼<br />以查看詳細資訊</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Sticker Info Panel (Only visible in NO_STICKER_IN mode with valid itemInfo) */}
                    {mode === 'NO_STICKER_IN' && itemInfo && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-gray-800 p-6 rounded-2xl border border-gray-700 h-full flex flex-col print-sticker-container"
                        >
                            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2 no-print">
                                <Package className="text-teal-400" />
                                貼紙資訊
                            </h3>

                            <div className="space-y-4 flex-grow bg-gray-900 border border-gray-600 p-5 rounded-xl font-mono text-sm shadow-inner printable-sticker">
                                <div className="border-b border-gray-700 pb-2">
                                    <span className="text-gray-500 inline-block w-24">元件品號:</span>
                                    <span className="text-white font-bold text-lg">{barcode}</span>
                                </div>
                                <div className="border-b border-gray-700 pb-2">
                                    <span className="text-gray-500 block mb-2">料件條碼:</span>
                                    <div className="bg-white p-2 rounded flex justify-center">
                                        <img
                                            src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(itemInfo.item.barcode)}&scale=2&height=10&includetext=true`}
                                            alt={itemInfo.item.barcode}
                                            className="h-16 object-contain"
                                        />
                                    </div>
                                </div>
                                <div className="border-b border-gray-700 pb-2">
                                    <span className="text-gray-500 inline-block w-24">品名:</span>
                                    <span className="text-white font-medium text-lg">{itemInfo.item.name}</span>
                                </div>
                                <div className="border-b border-gray-700 pb-2">
                                    <span className="text-gray-500 inline-block w-24">數量:</span>
                                    <span className="text-yellow-400 font-bold text-2xl">{quantity || 0}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 inline-block w-24">入庫日期:</span>
                                    <span className="text-gray-300 font-bold text-lg">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handlePrintSticker}
                                className="mt-6 w-full py-3 rounded-xl font-bold bg-teal-700 hover:bg-teal-600 text-white border border-teal-500 transition-colors flex items-center justify-center gap-2 shadow-lg no-print"
                            >
                                <ArrowUpFromLine size={20} className="rotate-180" />
                                <span className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    列印貼紙資訊 (列印/PDF)
                                </span>
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Operations;
