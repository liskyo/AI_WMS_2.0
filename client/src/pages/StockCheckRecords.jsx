import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getStockCheckRecords, exportStockCheckRecords } from '../api';
import { FileSpreadsheet, Download, ClipboardCheck, Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { axiosErrorDetail } from '../userFacingMessages';

function startLocalDayBase(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endLocalDayMax(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Monday–Sunday calendar week */
function weekRangeMonday(d = new Date()) {
    const s = startLocalDayBase(d);
    const dow = s.getDay();
    const delta = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(s);
    mon.setDate(s.getDate() + delta);
    const sunStart = startLocalDayBase(mon);
    sunStart.setDate(mon.getDate() + 6);
    return {
        from: mon.toISOString(),
        to: endLocalDayMax(sunStart).toISOString(),
    };
}

function monthRange(d = new Date()) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: first.toISOString(), to: last.toISOString() };
}

function todayRange(d = new Date()) {
    return {
        from: startLocalDayBase(d).toISOString(),
        to: endLocalDayMax(d).toISOString(),
    };
}

function customRangeISO(fromYmd, toYmd) {
    const a = fromYmd ? new Date(`${fromYmd}T00:00:00`) : new Date();
    const b = toYmd ? new Date(`${toYmd}T00:00:00`) : new Date();
    const fromMs = Number.isNaN(a.getTime()) ? Date.now() : a.getTime();
    const toMs = Number.isNaN(b.getTime()) ? Date.now() : b.getTime();
    const lo = Math.min(fromMs, toMs);
    const hi = Math.max(fromMs, toMs);
    return {
        from: startLocalDayBase(new Date(lo)).toISOString(),
        to: endLocalDayMax(new Date(hi)).toISOString(),
    };
}

const StockCheckRecords = () => {
    const token = localStorage.getItem('token');
    const [preset, setPreset] = useState('month');
    const [customFrom, setCustomFrom] = useState(() =>
        startLocalDayBase(new Date()).toISOString().slice(0, 10)
    );
    const [customTo, setCustomTo] = useState(() =>
        startLocalDayBase(new Date()).toISOString().slice(0, 10)
    );

    const rangeBounds = useMemo(() => {
        if (preset === 'day') return todayRange();
        if (preset === 'week') return weekRangeMonday();
        if (preset === 'month') return monthRange();
        return customRangeISO(customFrom, customTo);
    }, [preset, customFrom, customTo]);

    const fromISO = rangeBounds.from;
    const toISO = rangeBounds.to;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);

    const meta = useMemo(
        () => ({
            labelFrom: new Date(fromISO).toLocaleString('zh-TW', { hour12: false }),
            labelTo: new Date(toISO).toLocaleString('zh-TW', { hour12: false }),
        }),
        [fromISO, toISO]
    );

    const fetchRecords = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const res = await getStockCheckRecords({ from: fromISO, to: toISO }, token);
            setItems(res.data.items ?? []);
        } catch (err) {
            setItems([]);
            setError(axiosErrorDetail(err, '載入失敗 Load failed'));
        } finally {
            setLoading(false);
        }
    }, [fromISO, toISO, token]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleDownload = async () => {
        if (!token) return;
        setDownloading(true);
        try {
            const res = await exportStockCheckRecords({ from: fromISO, to: toISO }, token);
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const d0 = fromISO.slice(0, 10).replace(/[^\d-]/g, '');
            const d1 = toISO.slice(0, 10).replace(/[^\d-]/g, '');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `盤點紀錄_${d0}_${d1}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(axiosErrorDetail(err, '下載失敗 Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="space-y-6 w-full max-w-[1600px] mx-auto">
            <header className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            to="/stockcheck"
                            className="text-cyan-400 hover:text-cyan-300 text-sm font-bold underline-offset-4 hover:underline"
                        >
                            ← 返回盤點作業
                        </Link>
                    </div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FileSpreadsheet className="text-indigo-400" size={32} />
                        盤點紀錄
                    </h1>
                    <p className="text-gray-400 mt-2">
                        可查詢歷史盤點明細並依區間下載 Excel。預設顯示方式：依「紀錄建立時間」篩選。
                    </p>
                </div>
            </header>

            <motion.div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm text-gray-400 font-bold whitespace-nowrap">快速區間：</span>
                    <button
                        type="button"
                        onClick={() => setPreset('day')}
                        className={clsx(
                            'px-4 py-2 rounded-xl font-bold border transition-colors',
                            preset === 'day'
                                ? 'bg-cyan-600 border-cyan-500 text-white'
                                : 'bg-gray-800/80 border-gray-600 text-gray-300 hover:border-gray-500'
                        )}
                    >
                        今日
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset('week')}
                        className={clsx(
                            'px-4 py-2 rounded-xl font-bold border transition-colors',
                            preset === 'week'
                                ? 'bg-cyan-600 border-cyan-500 text-white'
                                : 'bg-gray-800/80 border-gray-600 text-gray-300 hover:border-gray-500'
                        )}
                    >
                        本週（週一～週日）
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset('month')}
                        className={clsx(
                            'px-4 py-2 rounded-xl font-bold border transition-colors',
                            preset === 'month'
                                ? 'bg-cyan-600 border-cyan-500 text-white'
                                : 'bg-gray-800/80 border-gray-600 text-gray-300 hover:border-gray-500'
                        )}
                    >
                        本月
                    </button>
                    <button
                        type="button"
                        onClick={() => setPreset('custom')}
                        className={clsx(
                            'px-4 py-2 rounded-xl font-bold border transition-colors inline-flex items-center gap-2',
                            preset === 'custom'
                                ? 'bg-teal-600 border-teal-500 text-white'
                                : 'bg-gray-800/80 border-gray-600 text-gray-300 hover:border-gray-500'
                        )}
                    >
                        <ClipboardCheck size={18} /> 自訂
                    </button>
                    <button
                        type="button"
                        disabled={downloading || !token}
                        onClick={handleDownload}
                        className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white border border-emerald-500/70"
                    >
                        {downloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                        {downloading ? '匯出中…' : '下載 Excel（目前區間）'}
                    </button>
                </div>

                {preset === 'custom' && (
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 font-bold">起日（含）</label>
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 font-bold">迄日（含）</label>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white"
                            />
                        </div>
                    </div>
                )}

                <div className="text-sm text-gray-500">
                    目前篩選：<span className="text-cyan-400 font-mono">{meta.labelFrom}</span> ～{' '}
                    <span className="text-cyan-400 font-mono">{meta.labelTo}</span>
                    <span className="ml-2 text-gray-600">（共 {items.length} 筆，最多顯示 25,000 筆）</span>
                </div>
            </motion.div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-700">
                            <tr>
                                <th className="p-3 whitespace-nowrap">時間</th>
                                <th className="p-3 whitespace-nowrap">盤點儲位</th>
                                <th className="p-3 whitespace-nowrap">品號</th>
                                <th className="p-3 min-w-[8rem]">品名</th>
                                <th className="p-3 whitespace-nowrap">單位</th>
                                <th className="p-3 text-right whitespace-nowrap">系統數量</th>
                                <th className="p-3 whitespace-nowrap">帳料結果</th>
                                <th className="p-3 min-w-[10rem]">不符原因</th>
                                <th className="p-3 whitespace-nowrap">工號</th>
                                <th className="p-3 whitespace-nowrap">盤點人</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-gray-500">
                                        <Loader2 className="inline animate-spin mr-2" size={20} />
                                        載入中…
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-gray-500">
                                        此區間尚無盤點紀錄
                                    </td>
                                </tr>
                            ) : (
                                items.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-700/20 text-gray-200">
                                        <td className="p-3 whitespace-nowrap text-gray-400 font-mono text-xs">
                                            {row.created_at
                                                ? new Date(
                                                      row.created_at.includes('Z') || row.created_at.includes('T')
                                                          ? row.created_at
                                                          : row.created_at.replace(' ', 'T')
                                                  ).toLocaleString('zh-TW', { hour12: false })
                                                : '—'}
                                        </td>
                                        <td className="p-3 font-mono text-cyan-300">{row.location_code}</td>
                                        <td className="p-3 font-mono text-blue-300">{row.barcode}</td>
                                        <td className="p-3 text-white">{row.item_name || '—'}</td>
                                        <td className="p-3 text-gray-400">{row.unit || '—'}</td>
                                        <td className="p-3 text-right font-bold text-yellow-300">{row.system_quantity}</td>
                                        <td className="p-3">
                                            {row.matched === 1 ? (
                                                <span className="text-green-400 font-bold">帳料相符</span>
                                            ) : (
                                                <span className="text-orange-400 font-bold">帳料不符</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-gray-400 text-xs max-w-xs whitespace-pre-wrap">
                                            {row.mismatch_reason?.trim() || '—'}
                                        </td>
                                        <td className="p-3 font-mono text-xs">{row.employee_id || '—'}</td>
                                        <td className="p-3 text-white">{row.user_name || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockCheckRecords;
