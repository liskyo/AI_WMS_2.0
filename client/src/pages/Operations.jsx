import { useState, useRef, useEffect } from 'react';
import { submitTransaction, getItemDetails, getBom, submitBomTransaction, getWorkOrderForOut, submitMoOutTransaction } from '../api';
import { Scan, ArrowDownToLine, ArrowUpFromLine, CheckCircle, AlertTriangle, Package, Layers, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
    OPS_BOM_MISMATCH,
    OPS_STAGED,
    OPS_BOM_SELECTED,
    OPS_SKIPPED,
    OPS_BOM_OUT_SUCCESS,
    OPS_PRINT_READY,
    OPS_TX_SUCCESS,
    OPERATION_FAILED,
    BATCH_OUT_FAILED,
    MOBILE_IN,
    MOBILE_OUT,
    OPS_CONFIRM_SKIP_COMPONENT,
    OPS_CONFIRM_PARTIAL_BOM,
    OPS_CONFIRM_ZERO_COMPONENT_PICKS,
    OPS_MO_MISMATCH,
    OPS_MO_SELECTED,
    OPS_MO_OUT_SUCCESS,
    OPS_CONFIRM_PARTIAL_MO,
    OPS_CONFIRM_ZERO_MO_PICKS,
    OPS_CONFIRM_SKIP_MO_LINE,
    axiosErrorDetail,
} from '../userFacingMessages';

const Operations = () => {
    const [mode, setMode] = useState(() => {
        return sessionStorage.getItem('wms_ops_mode') || 'IN';
    }); // IN or OUT or BOM_OUT
    const [barcode, setBarcode] = useState('');
    const [locationCode, setLocationCode] = useState('');
    const [quantity, setQuantity] = useState('');
    const [locationMismatch, setLocationMismatch] = useState(false);
    const [quantityOverflow, setQuantityOverflow] = useState(false);
    const [maxAllowedQty, setMaxAllowedQty] = useState(null);
    const [itemInfo, setItemInfo] = useState(null);
    const [bomInfo, setBomInfo] = useState(() => {
        const saved = sessionStorage.getItem('wms_ops_bomInfo');
        return saved ? JSON.parse(saved) : null;
    }); // For BOM Outbound setup
    const [moInfo, setMoInfo] = useState(() => {
        const saved = sessionStorage.getItem('wms_ops_moInfo');
        return saved ? JSON.parse(saved) : null;
    });
    const [bomOutData, setBomOutData] = useState(() => {
        const saved = sessionStorage.getItem('wms_ops_bomOutData');
        return saved ? JSON.parse(saved) : {
            isActive: false,
            mainBarcode: '',
            sets: 1,
            components: [] // { component_barcode, required_total, picked_total, current_stock }
        };
    });

    const [moOutData, setMoOutData] = useState(() => {
        const saved = sessionStorage.getItem('wms_ops_moOutData');
        const base = saved
            ? JSON.parse(saved)
            : {
                  isActive: false,
                  workOrderNo: '',
                  openDate: null,
                  lines: [],
                  staged_picks: [],
                  skipped_barcodes: [],
              };
        return {
            ...base,
            skipped_barcodes: Array.isArray(base.skipped_barcodes) ? base.skipped_barcodes : [],
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
        if (moInfo) sessionStorage.setItem('wms_ops_moInfo', JSON.stringify(moInfo));
        else sessionStorage.removeItem('wms_ops_moInfo');
    }, [moInfo]);

    useEffect(() => {
        sessionStorage.setItem('wms_ops_moOutData', JSON.stringify(moOutData));
    }, [moOutData]);

    useEffect(() => {
        if (mode === 'BOM_OUT' && bomOutData.isActive && barcode) {
            const comp = bomOutData.components.find((c) => c.component_barcode === barcode);
            if (comp) {
                const remaining = Math.max(0, comp.required_total - comp.picked_total);
                setMaxAllowedQty(remaining);
                if (remaining > 0) setQuantity(remaining.toString());
            } else {
                setMaxAllowedQty(null);
            }
        } else if (mode === 'MO_OUT' && moOutData.isActive && barcode) {
            const b = barcode.trim();
            const line = moOutData.lines.find((l) => l.material_barcode === b);
            if (moOutData.skipped_barcodes?.includes(b)) {
                setMaxAllowedQty(0);
                return;
            }
            if (line) {
                const picked = line.picked_qty_db + line.picked_session;
                const remaining = Math.max(0, line.required_qty - picked);
                setMaxAllowedQty(remaining);
                if (remaining > 0) setQuantity(remaining.toString());
            } else {
                setMaxAllowedQty(null);
            }
        } else {
            setMaxAllowedQty(null);
        }
    }, [barcode, mode, bomOutData.isActive, bomOutData.components, moOutData.isActive, moOutData.lines, moOutData.skipped_barcodes]);

    // 驗證 BOM／製令出庫數量不超過剩餘應出數量
    useEffect(() => {
        const pickMode = (mode === 'BOM_OUT' && bomOutData.isActive) || (mode === 'MO_OUT' && moOutData.isActive);
        if (pickMode && maxAllowedQty !== null && quantity !== '') {
            setQuantityOverflow(parseFloat(quantity) > maxAllowedQty);
        } else {
            setQuantityOverflow(false);
        }
    }, [quantity, mode, bomOutData.isActive, moOutData.isActive, maxAllowedQty]);

    // Cleanup and Focus Management
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    const barcodeInputRef = useRef(null);

    // 驗證出庫儲位是否與料件實際所在儲位相符
    useEffect(() => {
        const outboundPick =
            mode === 'OUT' ||
            (mode === 'BOM_OUT' && bomOutData.isActive) ||
            (mode === 'MO_OUT' && moOutData.isActive);
        if (!outboundPick || !locationCode.trim()) {
            setLocationMismatch(false);
            return;
        }
        if (mode === 'OUT' && itemInfo) {
            const validLocations = itemInfo.inventory.map((inv) => inv.location_code);
            setLocationMismatch(validLocations.length > 0 && !validLocations.includes(locationCode.trim()));
            return;
        }
        if (mode === 'BOM_OUT' && bomOutData.isActive && barcode) {
            const comp = bomOutData.components.find((c) => c.component_barcode === barcode.trim());
            if (comp && comp.locations) {
                const locList = comp.locations.split(',').map((l) => {
                    const trimmed = l.trim();
                    const colonIdx = trimmed.lastIndexOf(':');
                    return colonIdx > 0 ? trimmed.substring(0, colonIdx) : trimmed;
                });
                setLocationMismatch(locList.length > 0 && locList[0] !== '' && !locList.includes(locationCode.trim()));
            } else {
                setLocationMismatch(false);
            }
            return;
        }
        if (mode === 'MO_OUT' && moOutData.isActive && barcode) {
            const b = barcode.trim();
            const line = moOutData.lines.find((l) => l.material_barcode === b);
            if (line && moOutData.skipped_barcodes?.includes(b)) {
                setLocationMismatch(false);
                return;
            }
            if (line && line.locations) {
                const locList = line.locations.split(',').map((l) => {
                    const trimmed = l.trim();
                    const colonIdx = trimmed.lastIndexOf(':');
                    return colonIdx > 0 ? trimmed.substring(0, colonIdx) : trimmed;
                });
                setLocationMismatch(locList.length > 0 && locList[0] !== '' && !locList.includes(locationCode.trim()));
            } else {
                setLocationMismatch(false);
            }
            return;
        }
        setLocationMismatch(false);
    }, [locationCode, mode, itemInfo, bomOutData, moOutData, barcode]);

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

    const fetchMoInfo = async () => {
        try {
            const trimmed = barcode.trim();
            const res = await getWorkOrderForOut(trimmed);
            setMoInfo(res.data);
        } catch (_e) {
            setMoInfo(null);
        }
    };

    useEffect(() => {
        if (!barcode) {
            setItemInfo(null);
            setBomInfo(null);
            setMoInfo(null);
            return;
        }
        if (mode === 'BOM_OUT' && !bomOutData.isActive) {
            fetchBomInfo();
        } else if (mode === 'MO_OUT' && !moOutData.isActive) {
            fetchMoInfo();
        } else if (mode !== 'BOM_OUT' && mode !== 'MO_OUT') {
            fetchItemInfo();
        }
    }, [barcode, mode, bomOutData.isActive, moOutData.isActive]);

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
                    setMessage({ type: 'error', text: OPS_BOM_MISMATCH });
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

                setMessage({ type: 'success', text: OPS_STAGED(bcode) });
            } else if (mode === 'MO_OUT' && moOutData.isActive) {
                const bcode = barcode.trim();
                const lcode = locationCode.trim();
                const qty = parseFloat(quantity);

                if (moOutData.skipped_barcodes?.includes(bcode)) {
                    setMessage({ type: 'error', text: '此材料已標記「略過不扣帳」，請勿再掃描暫存。\nThis line is waived — do not stage picks.' });
                    setLoading(false);
                    return;
                }

                if (!moOutData.lines.find((l) => l.material_barcode === bcode)) {
                    setMessage({ type: 'error', text: OPS_MO_MISMATCH });
                    setLoading(false);
                    return;
                }

                setMoOutData((prev) => ({
                    ...prev,
                    lines: prev.lines.map((line) =>
                        line.material_barcode === bcode ? { ...line, picked_session: line.picked_session + qty } : line
                    ),
                    staged_picks: [...(prev.staged_picks || []), { barcode: bcode, location_code: lcode, quantity: qty }]
                }));

                setMessage({ type: 'success', text: OPS_STAGED(bcode) });
            } else if (mode === 'OUT' || mode === 'IN' || mode === 'NO_STICKER_IN') {
                // Standard IN/OUT or NO_STICKER_IN
                // Map NO_STICKER_IN to standard IN for the backend API
                const apiMode = mode === 'NO_STICKER_IN' ? 'IN' : mode;
                const res = await submitTransaction({
                    type: apiMode,
                    barcode: barcode.trim(),
                    location_code: locationCode.trim(),
                    quantity: parseFloat(quantity)
                }, token);
                const inOutDisplay = apiMode === 'IN' ? MOBILE_IN : MOBILE_OUT;
                setMessage({
                    type: 'success',
                    text: OPS_TX_SUCCESS(inOutDisplay, res.data.newQty),
                });
            }

            setBarcode('');
            setLocationCode('');
            setQuantity('');
            setItemInfo(null);
            setLocationMismatch(false);
            setQuantityOverflow(false);
            setMaxAllowedQty(null);
            barcodeInputRef.current?.focus();
        } catch (err) {
            setMessage({
                type: 'error',
                text: axiosErrorDetail(err, OPERATION_FAILED),
            });
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
        setMessage({ type: 'success', text: OPS_BOM_SELECTED });
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
        if (!window.confirm(OPS_CONFIRM_SKIP_COMPONENT(component_barcode))) return;
        setBomOutData(prev => {
            const newComps = prev.components.map(comp => {
                if (comp.component_barcode === component_barcode) {
                    return { ...comp, picked_total: comp.required_total }; // Artificially mark as done
                }
                return comp;
            });
            return { ...prev, components: newComps };
        });
        setMessage({ type: 'success', text: OPS_SKIPPED(component_barcode) });
    };

    const handleConfirmBom = async () => {
        const allDone = bomOutData.components.every(c => c.picked_total >= c.required_total);
        if (!allDone) {
            if (!window.confirm(OPS_CONFIRM_PARTIAL_BOM)) return;
        }

        if (!bomOutData.staged_picks || bomOutData.staged_picks.length === 0) {
            if (!window.confirm(OPS_CONFIRM_ZERO_COMPONENT_PICKS)) return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await submitBomTransaction({
                main_barcode: bomOutData.mainBarcode,
                sets: bomOutData.sets,
                staged_picks: bomOutData.staged_picks
            }, token);

            setMessage({
                type: 'success',
                text: OPS_BOM_OUT_SUCCESS(bomOutData.mainBarcode, res.data.processedComponents),
            });
            setBomOutData({ isActive: false, mainBarcode: '', sets: 1, components: [], staged_picks: [] });
            setBomInfo(null);
            setBarcode('');
            setLocationCode('');
            setQuantity('');
        } catch (err) {
            setMessage({
                type: 'error',
                text: axiosErrorDetail(err, BATCH_OUT_FAILED),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStartMo = () => {
        if (!moInfo?.lines?.length) return;
        setMoOutData({
            isActive: true,
            workOrderNo: moInfo.work_order_no,
            openDate: moInfo.open_date || null,
            staged_picks: [],
            skipped_barcodes: [],
            lines: moInfo.lines.map((l) => ({
                material_barcode: l.material_barcode,
                material_name: l.material_name || '',
                required_qty: Number(l.required_qty),
                picked_qty_db: Number(l.picked_qty),
                picked_session: 0,
                current_stock: l.current_stock ?? 0,
                locations: l.locations || '',
                safe_stock: l.safe_stock ?? 0,
            }))
        });
        setBarcode('');
        setLocationCode('');
        setQuantity('');
        setMessage({ type: 'success', text: OPS_MO_SELECTED });
    };

    const handleCancelMo = () => {
        setMoOutData({
            isActive: false,
            workOrderNo: '',
            openDate: null,
            lines: [],
            staged_picks: [],
            skipped_barcodes: [],
        });
        setMoInfo(null);
        setBarcode('');
        setLocationCode('');
        setQuantity('');
        setMessage(null);
    };

    const handleSkipMoLine = (material_barcode) => {
        const bc = String(material_barcode || '').trim();
        if (!bc) return;
        if (!window.confirm(OPS_CONFIRM_SKIP_MO_LINE(bc))) return;
        const stagedFor = (moOutData.staged_picks || []).filter((p) => p.barcode === bc).length;
        if (stagedFor > 0) {
            setMessage({
                type: 'error',
                text: `${bc} 已有暫存掃描，請先確認出庫或取消作業後再略過。\nCannot waive — unstaged picks exist for this line.`,
            });
            return;
        }
        setMoOutData((prev) => {
            if (prev.skipped_barcodes.includes(bc)) return prev;
            return { ...prev, skipped_barcodes: [...prev.skipped_barcodes, bc] };
        });
        setMessage({ type: 'success', text: OPS_SKIPPED(bc) });
    };

    const handleConfirmMo = async () => {
        const skipped = moOutData.skipped_barcodes || [];
        const eps = 1e-9;
        const allDone = moOutData.lines.every((l) => {
            const isSkip = skipped.includes(l.material_barcode);
            const picked = l.picked_qty_db + l.picked_session;
            return isSkip || picked >= l.required_qty - eps;
        });
        if (!allDone) {
            if (!window.confirm(OPS_CONFIRM_PARTIAL_MO)) return;
        }

        const hasPicks = moOutData.staged_picks && moOutData.staged_picks.length > 0;
        const hasSkips = skipped.length > 0;
        if (!hasPicks && !hasSkips) {
            if (!window.confirm(OPS_CONFIRM_ZERO_MO_PICKS)) return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await submitMoOutTransaction(
                {
                    work_order_no: moOutData.workOrderNo,
                    staged_picks: moOutData.staged_picks || [],
                    skipped_barcodes: skipped,
                },
                token
            );

            setMessage({
                type: 'success',
                text: OPS_MO_OUT_SUCCESS(
                    moOutData.workOrderNo,
                    res.data.processedPickLines ?? 0,
                    res.data.processedSkips ?? 0,
                    res.data.work_order_fully_picked
                ),
            });
            setMoOutData({
                isActive: false,
                workOrderNo: '',
                openDate: null,
                lines: [],
                staged_picks: [],
                skipped_barcodes: [],
            });
            setMoInfo(null);
            setBarcode('');
            setLocationCode('');
            setQuantity('');
        } catch (err) {
            setMessage({
                type: 'error',
                text: axiosErrorDetail(err, BATCH_OUT_FAILED),
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSticker = () => {
        if (!itemInfo) return;
        window.print();
        setMessage({ type: 'success', text: OPS_PRINT_READY });
    };

    const bomPickActive = mode === 'BOM_OUT' && bomOutData.isActive;
    const moPickActive = mode === 'MO_OUT' && moOutData.isActive;
    const moBarcodeWaived =
        moPickActive && barcode.trim() && (moOutData.skipped_barcodes || []).includes(barcode.trim());
    const needsItemMaster = mode === 'IN' || mode === 'OUT' || mode === 'NO_STICKER_IN';

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
                        onClick={() => { setMode('MO_OUT'); setBarcode(''); }}
                        className={clsx(
                            "px-6 py-2 rounded-md font-bold transition-all flex items-center gap-2",
                            mode === 'MO_OUT' ? "bg-violet-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                        )}
                    >
                        <ClipboardList size={18} /> 製令工單出庫 (MO Pick)
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
                        ) : mode === 'MO_OUT' && !moOutData.isActive ? (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        1. 輸入製令編號 (欄位 A)
                                    </label>
                                    <div className="relative">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                        <input
                                            ref={barcodeInputRef}
                                            type="text"
                                            className="w-full bg-gray-700 border border-gray-600 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono placeholder-gray-500 transition-all focus:border-blue-500"
                                            placeholder="製令編號..."
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    {barcode && !moInfo && !loading && (
                                        <p className="mt-2 text-sm text-red-400 font-bold bg-red-500/10 p-2 rounded border border-red-500/20">
                                            ⚠️ 查無載入資料：無此製令、尚未匯入、或已全部領畢（可查「製令工單出入庫紀錄」）；若要再領請重新匯入
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleStartMo}
                                    disabled={!moInfo?.lines?.length}
                                    className="w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white"
                                >
                                    開始領料（免選套數）
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
                                {mode === 'MO_OUT' && moOutData.isActive && (
                                    <div className="bg-violet-500/10 border border-violet-500/50 p-4 rounded-xl mb-4 text-violet-300 flex justify-between items-center flex-wrap gap-2">
                                        <div>
                                            <span className="font-bold">製令：{moOutData.workOrderNo}</span>
                                            {moOutData.openDate && (
                                                <span className="ml-2 text-sm text-violet-200/90">開單：{moOutData.openDate}</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handleConfirmMo} className="text-sm px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold transition-colors shadow-lg">確認領料出庫</button>
                                            <button type="button" onClick={handleCancelMo} className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors border border-gray-600">取消作業</button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        {bomPickActive
                                            ? '1. 掃描元件條碼 (Component Barcode)'
                                            : moPickActive
                                                ? '1. 掃描材料品號 (元件品號)'
                                                : '1. 掃描料件條碼 (Item Barcode)'}
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
                                    {needsItemMaster && barcode && !itemInfo && !loading && (
                                        <p className="mt-2 text-sm text-red-400 font-bold bg-red-500/10 p-2 rounded border border-red-500/20">
                                            ⚠️ 總表內無此料件，無法作業！
                                        </p>
                                    )}
                                    {moPickActive && barcode.trim() && moOutData.lines.some((l) => l.material_barcode === barcode.trim()) && moBarcodeWaived && (
                                        <p className="mt-2 text-sm text-amber-300 font-bold bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                            此材料已標記「略過不扣帳」，請勿再掃描暫存
                                        </p>
                                    )}
                                    {moPickActive && barcode.trim() && !moOutData.lines.some((l) => l.material_barcode === barcode.trim()) && (
                                        <p className="mt-2 text-sm text-red-400 font-bold bg-red-500/10 p-2 rounded border border-red-500/20">
                                            ⚠️ 此材料品號不在本製令領料清單內
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
                                            disabled={needsItemMaster && !itemInfo}
                                        />
                                    </div>
                                    {locationMismatch && (
                                        <div className="mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-400 font-bold text-sm animate-pulse">
                                            <AlertTriangle size={18} />
                                            <span>⚠️ 此儲位非該料件目前所在位置！無法出庫。正確儲位請參考右側庫存分佈。</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        3. 建議／實際領取數量（可領少不可領多）
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono font-bold placeholder-gray-500 transition-all focus:border-blue-500"
                                        placeholder="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min={bomPickActive || moPickActive ? '0' : '0.001'}
                                        step="any"
                                        required
                                        disabled={needsItemMaster && !itemInfo}
                                    />
                                    {quantityOverflow && (
                                        <div className="mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-400 font-bold text-sm animate-pulse">
                                            <AlertTriangle size={18} />
                                            <span>⚠️ 數量超過剩餘應出數量（最多 {maxAllowedQty}）！無法出庫。</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || (needsItemMaster && !itemInfo) || locationMismatch || quantityOverflow || moBarcodeWaived}
                                    className={clsx(
                                        "w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                        mode === 'IN'
                                            ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white"
                                            : mode === 'NO_STICKER_IN'
                                                ? "bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white"
                                                : mode === 'OUT'
                                                    ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white"
                                                    : mode === 'MO_OUT' && moPickActive
                                                        ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white"
                                                        : "bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white"
                                    )}
                                >
                                    {loading
                                        ? '處理中...'
                                        : mode === 'IN'
                                            ? '確認入庫'
                                            : mode === 'NO_STICKER_IN'
                                                ? '確認入庫 (無貼紙)'
                                                : mode === 'OUT'
                                                    ? '確認出庫'
                                                    : moPickActive
                                                        ? '暫存此筆領料'
                                                        : '確認元件出庫'}
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
                            {mode === 'BOM_OUT' ? (
                                <Layers className="text-yellow-400" />
                            ) : mode === 'MO_OUT' ? (
                                <ClipboardList className="text-violet-400" />
                            ) : (
                                <Package className="text-blue-400" />
                            )}
                            {mode === 'BOM_OUT' ? '主件資訊' : mode === 'MO_OUT' ? '製令領料資訊' : '料件資訊'}
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
                        ) : mode === 'MO_OUT' ? (
                            moOutData.isActive ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-700/50 rounded-xl mb-4">
                                        <span className="text-gray-400 text-xs uppercase tracking-wider">材料領取進度（含本次暫存）</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {moOutData.lines.map((line, idx) => {
                                            const picked = line.picked_qty_db + line.picked_session;
                                            const isWaived = (moOutData.skipped_barcodes || []).includes(line.material_barcode);
                                            const rem = isWaived ? 0 : Math.max(0, line.required_qty - picked);
                                            const isDone = isWaived || picked >= line.required_qty;
                                            const stagedForLine = (moOutData.staged_picks || []).some((p) => p.barcode === line.material_barcode);
                                            const isWarning =
                                                line.current_stock <
                                                Math.max(0, line.required_qty - line.picked_qty_db);
                                            return (
                                                <li
                                                    key={idx}
                                                    className={clsx(
                                                        'border p-3 rounded-lg text-sm transition-colors',
                                                        isDone ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-900 border-gray-600'
                                                    )}
                                                >
                                                    <div className="flex justify-between items-center mb-1 gap-2">
                                                        <span className="font-mono text-blue-300">{line.material_barcode}</span>
                                                        <span className="text-xs text-gray-500 truncate text-right">{line.material_name}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        需領(AK)：{line.required_qty}　已領(AL+暫存)：{picked.toFixed(4)}　剩餘：{rem.toFixed(4)}
                                                    </div>
                                                    <div className="flex justify-between items-start mt-2 gap-2">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={clsx('text-xs', isWarning ? 'text-red-400 font-bold' : 'text-gray-400')}>
                                                                總庫存: {line.current_stock}
                                                            </span>
                                                            <span className="text-xs text-gray-400 mt-1">儲位: {line.locations || '無'}</span>
                                                            {isWaived && (
                                                                <span className="mt-2 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded w-fit">
                                                                    略過不扣帳（結案時寫紀錄並加已領）
                                                                </span>
                                                            )}
                                                            {!isDone && !isWaived && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSkipMoLine(line.material_barcode)}
                                                                    disabled={stagedForLine}
                                                                    title={stagedForLine ? '請先確認或取消／勿與暫存並用' : undefined}
                                                                    className={clsx(
                                                                        'mt-2 text-xs px-2 py-1 rounded transition-colors border w-fit',
                                                                        stagedForLine
                                                                            ? 'opacity-40 cursor-not-allowed border-gray-600 text-gray-500'
                                                                            : 'bg-amber-900/40 hover:bg-amber-800/60 border-amber-600/40 text-amber-200'
                                                                    )}
                                                                >
                                                                    略過(不扣帳)
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-xs text-gray-400">進度 </span>
                                                            <span className={clsx('font-bold text-lg', isDone ? 'text-green-400' : 'text-violet-400')}>
                                                                {isWaived ? line.required_qty : picked}
                                                            </span>
                                                            <span className="text-gray-500"> / {line.required_qty}</span>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : moInfo ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-700/50 rounded-xl">
                                        <span className="text-gray-400 text-xs uppercase tracking-wider">製令編號</span>
                                        <div className="text-lg font-bold text-violet-400 font-mono">{moInfo.work_order_no}</div>
                                        {moInfo.open_date && (
                                            <div className="text-sm text-gray-400 mt-1">開單日期(Q)：{moInfo.open_date}</div>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">材料清單</span>
                                        <ul className="space-y-2">
                                            {moInfo.lines.map((ln, idx) => (
                                                <li key={idx} className="bg-gray-900 border border-gray-600 p-3 rounded-lg text-sm">
                                                    <div className="flex justify-between mb-1 gap-2">
                                                        <span className="font-mono text-blue-300">{ln.material_barcode}</span>
                                                        <span className="text-xs text-gray-500 truncate">{ln.material_name}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        需領：{ln.required_qty}　已領：{ln.picked_qty}　剩餘領取：
                                                        {Math.max(0, Number(ln.required_qty) - Number(ln.picked_qty))}
                                                    </div>
                                                    <div
                                                        className={clsx(
                                                            'text-xs mt-1',
                                                            (ln.current_stock ?? 0) < Math.max(0, Number(ln.required_qty) - Number(ln.picked_qty))
                                                                ? 'text-red-400 font-bold'
                                                                : 'text-gray-400'
                                                        )}
                                                    >
                                                        總庫存 {ln.current_stock ?? 0}　儲位 {ln.locations || '無'}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-10">
                                    <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>請輸入製令編號</p>
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

                            <div className="printable-sticker">
                                <div className="sticker-barcode-section">
                                    <div className="sticker-barcode-image">
                                        <img
                                            src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(itemInfo.item.barcode)}&scale=2&height=10&includetext=true`}
                                            alt={itemInfo.item.barcode}
                                        />
                                    </div>
                                </div>
                                <div className="sticker-details-section">
                                    <div className="sticker-field sticker-details-full">
                                        <span className="sticker-label">元件品號:</span>
                                        <span className="sticker-value font-bold text-base md:text-lg">{barcode}</span>
                                    </div>
                                    <div className="sticker-field sticker-details-full">
                                        <span className="sticker-label">品名:</span>
                                        <span className="sticker-value font-medium text-sm md:text-base">{itemInfo.item.name}</span>
                                    </div>
                                    <div className="sticker-field">
                                        <span className="sticker-label">數量:</span>
                                        <span className="sticker-value qty-text">{quantity || 0}</span>
                                    </div>
                                    <div className="sticker-field">
                                        <span className="sticker-label">入庫日期:</span>
                                        <span className="sticker-value font-medium text-xs md:text-sm">
                                            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}
                                        </span>
                                    </div>
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
