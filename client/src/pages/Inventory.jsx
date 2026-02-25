import { useState, useEffect } from 'react';
import { getItems, getBom } from '../api';
import { Search, Package, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

const Inventory = () => {
    const [activeTab, setActiveTab] = useState('item'); // 'item' or 'bom'
    const [items, setItems] = useState([]);
    const [bomData, setBomData] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'item') {
            fetchItems();
        } else {
            fetchBom();
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
                    </div>

                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder={activeTab === 'item' ? "搜尋 元件品號 / 品名..." : "搜尋 主件品號..."}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
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
                            <tr><td colSpan="5" className="p-8 text-center text-gray-400">搜尋中...</td></tr>
                        ) : activeTab === 'item' ? (
                            items.length > 0 ? (
                                items.map((item, idx) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
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
                        ) : (
                            bomData.length > 0 ? (
                                bomData.flatMap((bom, bIdx) =>
                                    bom.components.map((comp, cIdx) => (
                                        <motion.tr
                                            key={`${bom.main_barcode}-${comp.component_barcode}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: (bIdx * 0.1) + (cIdx * 0.02) }}
                                            className="hover:bg-gray-700/30 transition-colors"
                                        >
                                            <td className="p-4 pl-6 font-mono text-yellow-400 font-bold">{cIdx === 0 ? bom.main_barcode : ''}</td>
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
                                    ))
                                )
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
        </div>
    );
};

export default Inventory;
