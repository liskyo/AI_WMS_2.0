import { useState, useRef, useEffect } from 'react';
import { getLocationInventory } from '../api';
import { Scan, ClipboardCheck, CheckCircle, Package, AlertTriangle, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { QUERY_FAILED_FALLBACK, STOCK_LOCATION_EMPTY_ZH_EN, axiosErrorDetail } from '../userFacingMessages';

const StockCheck = () => {
    const [locationCode, setLocationCode] = useState('');
    const [locationInfo, setLocationInfo] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [checkedItems, setCheckedItems] = useState({}); // { barcode: true/false }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!locationCode.trim()) return;
        setLoading(true);
        setError(null);
        setCheckedItems({});

        try {
            const res = await getLocationInventory(locationCode.trim());
            setLocationInfo(res.data.location);
            setInventory(res.data.inventory);
            if (res.data.inventory.length === 0) {
                setError(STOCK_LOCATION_EMPTY_ZH_EN);
            }
        } catch (err) {
            setLocationInfo(null);
            setInventory([]);
            setError(axiosErrorDetail(err, QUERY_FAILED_FALLBACK));
        } finally {
            setLoading(false);
        }
    };

    const toggleCheck = (barcode) => {
        setCheckedItems(prev => ({
            ...prev,
            [barcode]: !prev[barcode]
        }));
    };

    const toggleAll = () => {
        const allChecked = inventory.length > 0 && inventory.every(inv => checkedItems[inv.barcode]);
        if (allChecked) {
            setCheckedItems({});
        } else {
            const newChecked = {};
            inventory.forEach(inv => { newChecked[inv.barcode] = true; });
            setCheckedItems(newChecked);
        }
    };

    const handleReset = () => {
        setLocationCode('');
        setLocationInfo(null);
        setInventory([]);
        setCheckedItems({});
        setError(null);
        inputRef.current?.focus();
    };

    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const totalCount = inventory.length;
    const allDone = totalCount > 0 && checkedCount === totalCount;

    return (
        <div className="space-y-6 w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ClipboardCheck className="text-cyan-400" size={32} />
                        盤點作業
                    </h2>
                    <p className="text-gray-400 mt-1">掃描或輸入儲位代碼，逐一核對料件</p>
                </div>

                {inventory.length > 0 && (
                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "px-4 py-2 rounded-xl font-bold text-lg border",
                            allDone
                                ? "bg-green-500/20 text-green-400 border-green-500/50"
                                : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                        )}>
                            {allDone ? '✅ 盤點完成' : `${checkedCount} / ${totalCount} 已核對`}
                        </div>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                        >
                            <RotateCcw size={16} />
                            重新盤點
                        </button>
                    </div>
                )}
            </header>

            {/* Search Bar */}
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-2xl">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={22} />
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full bg-gray-700 border border-gray-600 text-white pl-12 pr-4 py-4 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-xl font-mono placeholder-gray-500 transition-all focus:border-cyan-500"
                            placeholder="掃描或輸入儲位代碼（例如：4A-01-1）"
                            value={locationCode}
                            onChange={(e) => setLocationCode(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !locationCode.trim()}
                        className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {loading ? '查詢中...' : '查詢儲位'}
                    </button>
                </form>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400"
                    >
                        <AlertTriangle size={20} />
                        <span className="font-medium">{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Location Info Header */}
            {locationInfo && inventory.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800 p-5 rounded-2xl border border-gray-700 flex flex-wrap items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-500/20 p-3 rounded-xl">
                            <Package className="text-cyan-400" size={28} />
                        </div>
                        <div>
                            <div className="text-sm text-gray-400">盤點儲位</div>
                            <div className="text-2xl font-bold font-mono text-cyan-400">{locationInfo.code}</div>
                        </div>
                        {locationInfo.floor && (
                            <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-sm font-medium">
                                {locationInfo.floor}
                            </span>
                        )}
                        {locationInfo.is_closed ? (
                            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-sm font-bold border border-red-500/30">
                                🚫 已關閉
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleAll}
                            className={clsx(
                                "px-5 py-2.5 rounded-xl font-bold transition-all border",
                                allDone
                                    ? "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
                                    : "bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500"
                            )}
                        >
                            {allDone ? '取消全選' : '全部勾選'}
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Inventory Cards - Large for easy stocktaking */}
            {inventory.length > 0 && (
                <div className="space-y-3">
                    {inventory.map((inv, idx) => {
                        const isChecked = !!checkedItems[inv.barcode];
                        return (
                            <motion.div
                                key={inv.barcode}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => toggleCheck(inv.barcode)}
                                className={clsx(
                                    "flex items-center gap-5 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none",
                                    isChecked
                                        ? "bg-green-500/10 border-green-500/50 shadow-lg shadow-green-900/20"
                                        : "bg-gray-800 border-gray-700 hover:border-cyan-500/50 hover:bg-gray-750"
                                )}
                            >
                                {/* Checkbox */}
                                <div className={clsx(
                                    "w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all",
                                    isChecked
                                        ? "bg-green-500 border-green-500"
                                        : "border-gray-500 hover:border-cyan-400"
                                )}>
                                    {isChecked && <CheckCircle size={24} className="text-white" />}
                                </div>

                                {/* Item Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-lg font-mono font-bold text-blue-400">{inv.barcode}</span>
                                        {inv.unit && (
                                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">{inv.unit}</span>
                                        )}
                                    </div>
                                    <div className="text-base text-white font-medium truncate">{inv.name}</div>
                                    {inv.description && (
                                        <div className="text-sm text-gray-500 truncate mt-0.5">{inv.description}</div>
                                    )}
                                </div>

                                {/* Quantity - Large */}
                                <div className="text-right shrink-0">
                                    <div className="text-sm text-gray-400 mb-1">系統數量</div>
                                    <div className={clsx(
                                        "text-4xl font-bold font-mono",
                                        isChecked ? "text-green-400" : "text-yellow-400"
                                    )}>
                                        {inv.quantity}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Completion Summary */}
            <AnimatePresence>
                {allDone && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-6 bg-green-500/10 border-2 border-green-500/50 rounded-2xl text-center shadow-lg"
                    >
                        <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                        <div className="text-2xl font-bold text-green-400 mb-1">盤點完成！</div>
                        <div className="text-gray-400">
                            儲位 <span className="text-cyan-400 font-mono font-bold">{locationInfo?.code}</span> 共 {totalCount} 筆料件全部核對完成
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StockCheck;
