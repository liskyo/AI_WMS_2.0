import { useState, useEffect } from 'react';
import { getItems, getBom, getWorkOrders } from '../api';
import { Search, Package, Layers, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';

const Inventory = () => {
    const [activeTab, setActiveTab] = useState('item'); // 'item' | 'bom' | 'mo'
    const [items, setItems] = useState([]);
    const [bomData, setBomData] = useState([]);
    const [moGroups, setMoGroups] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        setCurrentPage(1);
        if (activeTab === 'item') {
            fetchItems();
        } else if (activeTab === 'bom') {
            fetchBom();
        } else {
            fetchMo();
        }
    }, [search, activeTab]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await getItems(search);
            setItems(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBom = async () => {
        setLoading(true);
        try {
            const res = await getBom(search);
            setBomData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMo = async () => {
        setLoading(true);
        try {
            const res = await getWorkOrders(search);
            setMoGroups(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setMoGroups([]);
        } finally {
            setLoading(false);
        }
    };

    const tableLoadingColSpan = activeTab === 'item' ? 6 : activeTab === 'mo' ? 2 : 6;

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <div>
                    <h2 className="text-3xl font-bold text-white">庫存查詢</h2>
                    <p className="text-gray-400">查詢料件、條碼及位置</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => { setActiveTab('item'); setSearch(''); }}
                            className={`px-4 py-2 rounded-md font-bold transition-all flex items-center gap-2 ${activeTab === 'item' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Package size={16} /> 料件查詢
                        </button>
                        <button
                            onClick={() => { setActiveTab('bom'); setSearch(''); }}
                            className={`px-4 py-2 rounded-md font-bold transition-all flex items-center gap-2 ${activeTab === 'bom' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Layers size={16} /> 主件查詢
                        </button>
                        <button
                            onClick={() => { setActiveTab('mo'); setSearch(''); }}
                            className={`px-4 py-2 rounded-md font-bold transition-all flex items-center gap-2 ${activeTab === 'mo' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <ClipboardList size={16} /> 製令查詢
                        </button>
                    </div>

                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder={
                                activeTab === 'item'
                                    ? '搜尋 元件品號 / 品名...'
                                    : activeTab === 'bom'
                                        ? '搜尋 主件品號...'
                                        : '搜尋 製令編號...'
                            }
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.select(); }}
                        />
                    </div>
                </div>
            </header>

            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-900/50 border-b border-gray-700 text-gray-400 text-sm uppercase">
                            {activeTab === 'item' ? (
                                <>
                                    <th className="p-4 pl-6">元件品號 (Barcode)</th>
                                    <th className="p-4">品名</th>
                                    <th className="p-4">規格</th>
                                    <th className="p-4">儲位分佈</th>
                                    <th className="p-4 text-right pr-6">總庫存量</th>
                                    <th className="p-4 text-right pr-6">安全庫存</th>
                                </>
                            ) : activeTab === 'mo' ? (
                                <>
                                    <th className="p-4 pl-6 w-[200px] align-top">
                                        <span className="block">製令編號(A)</span>
                                        <span className="block text-[10px] uppercase font-normal text-gray-500 mt-1 normal-case tracking-normal">
                                            開單日期(Q)
                                        </span>
                                    </th>
                                    <th className="p-4 align-top">
                                        材料明細（材料品號＋品名、需領、已領、剩餘、總庫存、安全庫存、儲位）
                                    </th>
                                </>
                            ) : (
                                <>
                                    <th className="p-4 pl-6">主件品號</th>
                                    <th className="p-4 pl-6">所需元件</th>
                                    <th className="p-4">組成用量</th>
                                    <th className="p-4">儲位分佈</th>
                                    <th className="p-4 text-right pr-6">剩餘庫存</th>
                                    <th className="p-4 text-right pr-6">安全庫存</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            <tr><td colSpan={tableLoadingColSpan} className="p-8 text-center text-gray-400">搜尋中...</td></tr>
                        ) : activeTab === 'item' ? (
                            items.length > 0 ? (
                                items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (idx % itemsPerPage) * 0.05 }}
                                        className="hover:bg-gray-700/30 transition-colors"
                                    >
                                        <td className="p-4 pl-6 font-mono text-blue-400 font-medium">{item.barcode}</td>
                                        <td className="p-4 font-bold text-white">{item.name}</td>
                                        <td className="p-4 text-gray-400">{item.description || '-'}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {item.locations ? item.locations.split(',').map((loc, i) => {
                                                    const match = loc.trim().match(/(.+?)\s*\((.+?)\)/) || loc.trim().match(/(.+?):(.+?)/);
                                                    const code = match ? match[1] : loc.trim();
                                                    const qty = match ? match[2] : null;
                                                    return (
                                                        <span key={i} className="bg-gray-800/80 border border-gray-600 px-2 py-1 rounded text-xs flex items-center shrink-0">
                                                            {qty !== null ? (
                                                                <>
                                                                    <span className="text-blue-300">{code}</span>
                                                                    <span className="text-yellow-500 font-bold ml-[2px]">({qty})</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-blue-300">{code}</span>
                                                            )}
                                                        </span>
                                                    );
                                                }) : <span className="text-gray-600 text-sm">-</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <span className={`px-3 py-1 rounded-lg font-bold bg-green-600/20 text-green-400`}>
                                                {item.total_quantity}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <span className="px-3 py-1 rounded-lg font-bold bg-red-600/20 text-red-400">
                                                {item.safe_stock || 0}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
                                        無符合資料
                                    </td>
                                </tr>
                            )
                        ) : activeTab === 'mo' ? (
                            moGroups.length > 0 ? (
                                moGroups
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((g, pageIdx) => (
                                        <motion.tr
                                            key={g.work_order_no}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: (pageIdx % itemsPerPage) * 0.02 }}
                                            className="hover:bg-gray-700/30 transition-colors border-b border-gray-800 last:border-b-0"
                                        >
                                            <td className="p-4 pl-6 font-mono align-top pt-6">
                                                <div className="text-violet-400 font-bold text-lg leading-tight">{g.work_order_no}</div>
                                                <div className="text-xs text-gray-500 mt-2">開單：{g.open_date || '—'}</div>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-2">
                                                    {(g.lines || []).map((line) => {
                                                        const rem =
                                                            line.remaining_pick ??
                                                            Math.max(0, Number(line.required_qty) - Number(line.picked_qty));
                                                        return (
                                                            <div
                                                                key={`${g.work_order_no}-${line.material_barcode}`}
                                                                className="flex flex-col gap-3 bg-gray-800/60 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors sm:flex-row sm:items-start sm:flex-wrap"
                                                            >
                                                                <div className="min-w-0 shrink-0 sm:max-w-[240px]">
                                                                    <span className="bg-violet-500/15 text-violet-300 px-2 py-1 rounded font-mono text-xs font-bold border border-violet-500/30">
                                                                        {line.material_barcode}
                                                                    </span>
                                                                    <div className="text-gray-300 font-semibold text-sm mt-2">{line.material_name || '—'}</div>
                                                                </div>
                                                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:flex-1 sm:justify-center">
                                                                    <span>
                                                                        <span className="text-gray-500 block">需領</span>
                                                                        <span className="text-white font-bold">{line.required_qty}</span>
                                                                    </span>
                                                                    <span>
                                                                        <span className="text-gray-500 block">已領</span>
                                                                        <span className="text-gray-300">{line.picked_qty}</span>
                                                                    </span>
                                                                    <span>
                                                                        <span className="text-gray-500 block">剩餘</span>
                                                                        <span className="text-amber-400 font-bold">{rem}</span>
                                                                    </span>
                                                                    <span>
                                                                        <span className="text-gray-500 block">總庫存</span>
                                                                        <span
                                                                            className={`font-bold ${(line.current_stock ?? 0) < rem ? 'text-red-400' : 'text-green-400'}`}
                                                                        >
                                                                            {line.current_stock ?? 0}
                                                                        </span>
                                                                    </span>
                                                                    <span>
                                                                        <span className="text-gray-500 block">安全庫存</span>
                                                                        <span className="text-red-400 font-bold">{line.safe_stock ?? 0}</span>
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 min-w-[120px] sm:ml-auto sm:justify-end">
                                                                    {line.locations ? (
                                                                        String(line.locations)
                                                                            .split(',')
                                                                            .map((loc, i) => {
                                                                                const t = loc.trim();
                                                                                const match = t.match(/(.+?)\s*\((.+?)\)/) || t.match(/(.+?):(.+?)/);
                                                                                const code = match ? match[1] : t;
                                                                                const qty = match ? match[2] : null;
                                                                                return (
                                                                                    <span
                                                                                        key={`${loc}-${i}`}
                                                                                        className="bg-gray-900/50 border border-gray-600 px-2 py-1 rounded text-xs shrink-0"
                                                                                    >
                                                                                        {qty != null ? (
                                                                                            <>
                                                                                                <span className="text-blue-300">{code}</span>
                                                                                                <span className="text-yellow-500 font-bold ml-[2px]">({qty})</span>
                                                                                            </>
                                                                                        ) : (
                                                                                            <span className="text-blue-300">{code}</span>
                                                                                        )}
                                                                                    </span>
                                                                                );
                                                                            })
                                                                    ) : (
                                                                        <span className="text-gray-600 text-sm">—</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                            ) : (
                                <tr>
                                    <td colSpan={2} className="p-8 text-center text-gray-500">
                                        無符合製令（或已全部領畢並自總表移除）
                                    </td>
                                </tr>
                            )
                        ) : (
                            bomData.length > 0 ? (
                                (() => {
                                    const allBomItems = bomData.flatMap(bom => bom.components.map(comp => ({ bom, comp })));
                                    const currentBomItems = allBomItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                                    return currentBomItems.map(({ bom, comp }, cIdx) => {
                                        const bIdx = bomData.indexOf(bom);
                                        return (
                                        <motion.tr
                                            key={`${bom.main_barcode}-${comp.component_barcode}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: (cIdx % itemsPerPage) * 0.02 }}
                                            className="hover:bg-gray-700/30 transition-colors"
                                        >
                                            <td className="p-4 pl-6 font-mono text-yellow-400 font-bold">{bomData.findIndex(b => b === bom) !== -1 && bomData.find(b => b === bom).components[0] === comp ? bom.main_barcode : ''}</td>
                                            <td className="p-4 font-mono text-blue-400">
                                                <div>{comp.component_barcode}</div>
                                                <div className="text-xs text-gray-500">{comp.component_name}</div>
                                            </td>
                                            <td className="p-4 text-gray-300 font-bold">{comp.required_qty}</td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {comp.locations ? comp.locations.split(',').map((loc, i) => {
                                                        const match = loc.trim().match(/(.+?)\s*\((.+?)\)/) || loc.trim().match(/(.+?):(.+?)/);
                                                        const code = match ? match[1] : loc.trim();
                                                        const qty = match ? match[2] : null;
                                                        return (
                                                            <span key={i} className="bg-gray-800/80 border border-gray-600 px-2 py-1 rounded text-xs flex items-center shrink-0">
                                                                {qty !== null ? (
                                                                    <>
                                                                        <span className="text-blue-300">{code}</span>
                                                                        <span className="text-yellow-500 font-bold ml-[2px]">({qty})</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-blue-300">{code}</span>
                                                                )}
                                                            </span>
                                                        );
                                                    }) : <span className="text-gray-600 text-sm">-</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <span className={`px-3 py-1 rounded-lg font-bold ${comp.current_stock < comp.required_qty ? 'bg-red-500/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                                                    {comp.current_stock}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <span className="px-3 py-1 rounded-lg font-bold bg-red-600/20 text-red-400">
                                                    {comp.safe_stock || 0}
                                                </span>
                                            </td>
                                        </motion.tr>
                                        );
                                    });
                                })()
                            ) : (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-500">
                                        無符合主件資料
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {(() => {
                const totalRows =
                    activeTab === 'item'
                        ? items.length
                        : activeTab === 'mo'
                            ? moGroups.length
                            : bomData.flatMap((b) => b.components).length;
                if (!(totalRows > itemsPerPage)) return null;
                return (
                <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <span className="text-gray-400">
                        顯示第 {(currentPage - 1) * itemsPerPage + 1} 到 {Math.min(currentPage * itemsPerPage, totalRows)}{' '}
                        {activeTab === 'mo' ? '筆製令' : '筆'}，共{' '}
                        <span className="font-bold text-white">{totalRows}</span>
                        {activeTab === 'mo' ? ' 筆製令' : ' 筆'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors"
                        >
                            上一頁
                        </button>
                        <span className="px-4 py-2 bg-gray-900 rounded-lg text-blue-400 font-bold border border-gray-700">
                            {currentPage} / {Math.ceil(totalRows / itemsPerPage)}
                        </span>
                        <button
                            disabled={currentPage === Math.ceil(totalRows / itemsPerPage)}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors"
                        >
                            下一頁
                        </button>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default Inventory;
