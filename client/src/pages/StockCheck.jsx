import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getLocationInventory, postStockCheckRecords } from '../api';
import { Scan, ClipboardCheck, CheckCircle, Package, AlertTriangle, RotateCcw, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { QUERY_FAILED_FALLBACK, STOCK_LOCATION_EMPTY_ZH_EN, axiosErrorDetail } from '../userFacingMessages';
import { useAuth } from '../context/AuthContext';

/** @typedef {{ matched: boolean | null; reason: string }} LineCheck */

const StockCheck = () => {
    const { user } = useAuth();
    const token = localStorage.getItem('token');
    const [locationCode, setLocationCode] = useState('');
    const [locationInfo, setLocationInfo] = useState(null);
    const [inventory, setInventory] = useState([]);
    /** @type {Record<string, LineCheck>} */
    const [lineChecks, setLineChecks] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState(null); // success / error bilingual or zh
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const resetLineChecks = () => setLineChecks({});

    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!locationCode.trim()) return;
        setLoading(true);
        setError(null);
        setSubmitMessage(null);
        resetLineChecks();

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

    const setLineMatched = useCallback((barcode, matched) => {
        setLineChecks((prev) => ({
            ...prev,
            [barcode]: {
                matched,
                reason: matched ? '' : prev[barcode]?.reason ?? '',
            },
        }));
        setSubmitMessage(null);
    }, []);

    const setLineReason = useCallback((barcode, reason) => {
        setLineChecks((prev) => ({
            ...prev,
            [barcode]: {
                matched: false,
                reason,
            },
        }));
        setSubmitMessage(null);
    }, []);

    const markAllMatched = () => {
        const next = {};
        inventory.forEach((inv) => {
            next[inv.barcode] = { matched: true, reason: '' };
        });
        setLineChecks(next);
        setSubmitMessage(null);
    };

    const handleReset = () => {
        setLocationCode('');
        setLocationInfo(null);
        setInventory([]);
        resetLineChecks();
        setError(null);
        setSubmitMessage(null);
        inputRef.current?.focus();
    };

    const resolvedLines = useMemo(() => {
        return inventory.filter((inv) => {
            const c = lineChecks[inv.barcode];
            if (!c || c.matched === null || c.matched === undefined) return false;
            if (c.matched === true) return true;
            return !!(c.reason && c.reason.trim());
        });
    }, [inventory, lineChecks]);

    const totalCount = inventory.length;
    const resolvedCount = resolvedLines.length;
    const allConfirmed = totalCount > 0 && resolvedCount === totalCount;

    const submitRecords = async () => {
        if (!allConfirmed || !locationInfo || !token) return;
        setSubmitting(true);
        setSubmitMessage(null);
        try {
            const lines = inventory.map((inv) => {
                const c = lineChecks[inv.barcode];
                return {
                    barcode: inv.barcode,
                    item_name: inv.name,
                    unit: inv.unit,
                    system_quantity: inv.quantity,
                    matched: c.matched === true,
                    mismatch_reason: c.matched === true ? '' : c.reason?.trim() || '',
                };
            });
            await postStockCheckRecords(
                {
                    location_code: locationInfo.code,
                    lines,
                },
                token
            );
            setSubmitMessage('盤點紀錄已儲存 Record saved.');
            resetLineChecks();
        } catch (err) {
            setSubmitMessage(axiosErrorDetail(err, '送出失敗 Save failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const firstUnsetBarcode = inventory.find((inv) => {
        const c = lineChecks[inv.barcode];
        if (!c || c.matched === null || c.matched === undefined) return true;
        if (c.matched === false && !(c.reason && c.reason.trim())) return true;
        return false;
    })?.barcode;

    return (
        <div className="space-y-6 w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ClipboardCheck className="text-cyan-400" size={32} />
                        盤點作業
                    </h2>
                    <p className="text-gray-400 mt-1">
                        請逐筆選擇「帳料相符」或「帳料不符」；不符時必填原因，再送出紀錄。
                        {user?.name ? (
                            <span className="text-cyan-500/90 ml-2">／ 目前登入：{user.name}</span>
                        ) : null}
                    </p>
                </div>

                {inventory.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 justify-end">
                        <div
                            className={clsx(
                                'px-4 py-2 rounded-xl font-bold text-lg border',
                                allConfirmed
                                    ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            )}
                        >
                            {allConfirmed
                                ? '✅ 已全部確認，可送出紀錄'
                                : `${resolvedCount} / ${totalCount} 筆已確認`}
                        </div>
                        <Link
                            to="/stockcheck/records"
                            className="px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold border border-indigo-500/60 transition-colors"
                        >
                            盤點紀錄
                        </Link>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
                            type="button"
                        >
                            <RotateCcw size={16} />
                            重新盤點
                        </button>
                    </div>
                )}
            </header>

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

            <AnimatePresence>
                {submitMessage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={clsx(
                            'p-4 rounded-xl border flex items-center gap-3',
                            submitMessage.includes('failed') || submitMessage.includes('失敗')
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : 'bg-green-500/10 border-green-500/40 text-green-400'
                        )}
                    >
                        {submitMessage.includes('失敗') || submitMessage.includes('failed') ? (
                            <AlertTriangle size={20} />
                        ) : (
                            <CheckCircle size={20} />
                        )}
                        <span className="font-medium">{submitMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

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
                            type="button"
                            onClick={markAllMatched}
                            className="px-5 py-2.5 rounded-xl font-bold transition-all border bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500"
                        >
                            全部標示帳料相符
                        </button>
                    </div>
                </motion.div>
            )}

            {inventory.length > 0 && (
                <div className="space-y-4">
                    {inventory.map((inv, idx) => {
                        const c = lineChecks[inv.barcode];
                        const selMatch = c?.matched === true;
                        const selMismatch = c?.matched === false;
                        const needReason = selMismatch && !(c.reason && c.reason.trim());
                        const isHighlightUnset = inv.barcode === firstUnsetBarcode && !allConfirmed;

                        return (
                            <motion.div
                                key={inv.barcode}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className={clsx(
                                    'p-5 rounded-2xl border-2 transition-all duration-200',
                                    selMatch && 'border-green-500/60 bg-green-500/10',
                                    selMismatch && !needReason && 'border-orange-500/50 bg-orange-500/10',
                                    selMismatch && needReason && 'border-red-500/50 bg-red-500/10',
                                    !selMatch && !selMismatch && 'border-gray-700 bg-gray-800',
                                    isHighlightUnset && 'ring-2 ring-yellow-500/40'
                                )}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-lg font-mono font-bold text-blue-400">{inv.barcode}</span>
                                            {inv.unit && (
                                                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">{inv.unit}</span>
                                            )}
                                        </div>
                                        <div className="text-base text-white font-medium">{inv.name}</div>
                                        {inv.description && (
                                            <div className="text-sm text-gray-500 truncate mt-0.5">{inv.description}</div>
                                        )}
                                    </div>

                                    <div className="text-right shrink-0 lg:min-w-[7rem]">
                                        <div className="text-sm text-gray-400 mb-1">系統數量</div>
                                        <div className="text-4xl font-bold font-mono text-yellow-400">{inv.quantity}</div>
                                    </div>

                                    <div className="flex flex-col gap-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setLineMatched(inv.barcode, true)}
                                                className={clsx(
                                                    'flex items-center gap-2 px-4 py-3 rounded-xl font-bold border transition-all flex-1 min-w-[9rem]',
                                                    selMatch
                                                        ? 'bg-green-600 text-white border-green-500 shadow-lg'
                                                        : 'bg-gray-800 text-gray-300 border-gray-600 hover:border-green-500/50'
                                                )}
                                            >
                                                <CheckCircle size={20} /> 帳料相符
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLineMatched(inv.barcode, false)}
                                                className={clsx(
                                                    'flex items-center gap-2 px-4 py-3 rounded-xl font-bold border transition-all flex-1 min-w-[9rem]',
                                                    selMismatch
                                                        ? 'bg-orange-700 text-white border-orange-500 shadow-lg'
                                                        : 'bg-gray-800 text-gray-300 border-gray-600 hover:border-orange-500/50'
                                                )}
                                            >
                                                <XCircle size={20} /> 帳料不符
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {selMismatch && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-1"
                                                >
                                                    <label className="text-xs text-orange-300 font-bold">不符原因（必填）</label>
                                                    <textarea
                                                        value={c?.reason ?? ''}
                                                        onChange={(e) => setLineReason(inv.barcode, e.target.value)}
                                                        rows={3}
                                                        className={clsx(
                                                            'w-full rounded-xl bg-gray-900 border px-3 py-2 text-sm text-white resize-y outline-none focus:ring-2',
                                                            needReason ? 'border-red-500 focus:ring-red-500/40' : 'border-gray-600 focus:ring-orange-500/40'
                                                        )}
                                                        placeholder="請說明現場數量／標籤／品項與系統不符狀況…"
                                                    />
                                                    {needReason ? (
                                                        <p className="text-xs text-red-400 flex items-center gap-1">
                                                            <AlertTriangle size={14} /> 請填寫原因後此筆才算確認完成
                                                        </p>
                                                    ) : null}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {allConfirmed && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-6 bg-gray-800 border-2 border-green-500/40 rounded-2xl space-y-4"
                    >
                        <div className="text-center">
                            <CheckCircle size={40} className="text-green-400 mx-auto mb-2 inline-block" />
                            <div className="text-xl font-bold text-green-400 mb-1">本儲位所有料件均已確認</div>
                            <div className="text-gray-400">
                                儲位 <span className="text-cyan-400 font-mono font-bold">{locationInfo?.code}</span> 共{' '}
                                {totalCount} 筆。按下「送出盤點紀錄」寫入系統以供查詢與匯出。
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                disabled={submitting || !token}
                                onClick={submitRecords}
                                className="px-10 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? '送出中…' : '送出盤點紀錄'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StockCheck;
