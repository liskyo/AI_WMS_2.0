import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getInventoryReport, deleteItem, getBom, updateSafeStock } from '../api';
import * as XLSX from 'xlsx';
import { Download, Layers, MapPin, Trash2, X, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const Reports = () => {
    const [data, setData] = useState([]);
    const [bomData, setBomData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('item'); // 'item', 'location', 'bom', 'low_stock'
    const [activeFloor, setActiveFloor] = useState(null);

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState(null); // { barcode, name }
    const [deletePassword, setDeletePassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const openDeleteModal = (item) => {
        setDeleteTarget(item);
        setDeletePassword('');
        setShowPassword(false);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget || !deletePassword) return;

        try {
            // Retrieve token if needed, or pass empty if relying on cookie (but we use token in headers)
            const token = localStorage.getItem('token');
            await deleteItem(deleteTarget.barcode, deletePassword, token);
            alert('刪除成功！');
            setIsDeleteModalOpen(false);
            fetchReport(); // Refresh data
        } catch (err) {
            alert('刪除失敗: ' + (err.response?.data?.error || err.message));
        }
    };

    useEffect(() => {
        fetchReport();
        const tab = searchParams.get('tab');
        if (['item', 'location', 'bom', 'low_stock'].includes(tab)) setActiveTab(tab);
    }, [searchParams]);

    const fetchReport = async () => {
        try {
            const [res, bomRes] = await Promise.all([
                getInventoryReport(),
                getBom()
            ]);
            setData(res.data);
            setBomData(bomRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Process Data for Item Summary (Sorted by barcode)
    const itemSummary = data.reduce((acc, curr) => {
        const existing = acc.find(i => i.barcode === curr.barcode);
        // Format location string if location exists
        const locStr = curr.location_code ? `${curr.location_code}(${curr.quantity})` : null;

        if (existing) {
            existing.totalQty += curr.quantity;
            if (locStr) existing.locations.push(locStr);
        } else {
            acc.push({
                barcode: curr.barcode,
                name: curr.item_name,
                description: curr.description || '',
                unit: curr.unit || '',
                category: curr.category || '',
                safe_stock: curr.safe_stock || 0,
                totalQty: curr.quantity,
                locations: locStr ? [locStr] : []
            });
        }
        return acc;
    }, []).sort((a, b) => a.barcode.localeCompare(b.barcode, undefined, { numeric: true }));

    // Low Stock Summary
    const lowStockSummary = itemSummary.filter(i => i.totalQty < i.safe_stock);

    // Extract unique floors for Location Summary mapping
    const floors = [...new Set(data.filter(d => d.location_code).map(d => d.floor).filter(Boolean))];
    if (floors.length === 0) floors.push('新大樓4樓');

    // Set active floor if not set
    useEffect(() => {
        if (!activeFloor && floors.length > 0) {
            setActiveFloor(floors[0]);
        }
    }, [floors, activeFloor]);

    // Process Data for Location Summary (Grouped by location code, sorted)
    // Filtered by active floor
    const locationSummary = data.filter(curr => curr.location_code && curr.quantity > 0 && curr.floor === activeFloor)
        .reduce((acc, curr) => {
            let existing = acc.find(l => l.code === curr.location_code);
            if (!existing) {
                existing = {
                    code: curr.location_code,
                    totalQuantity: 0,
                    items: []
                };
                acc.push(existing);
            }
            existing.totalQuantity += curr.quantity;
            existing.items.push({
                barcode: curr.barcode,
                name: curr.item_name,
                description: curr.description || '',
                unit: curr.unit || '',
                category: curr.category || '',
                quantity: curr.quantity
            });
            return acc;
        }, [])
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

        if (activeTab === 'item') {
            // Sheet 1: Item Summary
            const ws1Data = itemSummary.map(i => ({
                "元件品號": i.barcode,
                "品名": i.name,
                "規格": i.description,
                "庫存單位": i.unit,
                "庫別名稱": i.category,
                "儲位代碼": i.locations.join('\n'), // Spread across newlines or commas
                "數量": i.totalQty,
                "安全庫存": i.safe_stock || 0
            }));
            const ws1 = XLSX.utils.json_to_sheet(ws1Data);
            XLSX.utils.book_append_sheet(wb, ws1, "料件總表");
            XLSX.writeFile(wb, `庫存報表_料件總表_${dateStr}.xlsx`);
        } else if (activeTab === 'bom') {
            // Sheet 3: BOM Summary
            const wsBomData = [];
            bomData.forEach(bom => {
                bom.components.forEach(comp => {
                    wsBomData.push({
                        "主件品號": bom.main_barcode,
                        "元件品號": comp.component_barcode,
                        "品名": comp.component_name || '',
                        "規格": comp.description || '',
                        "單/複數單位": "單一",
                        "取替代品群組": "",
                        "屬性": "廠內",
                        "組成用量": comp.required_qty,
                        "當前庫存量": comp.current_stock,
                        "安全庫存": comp.safe_stock || 0,
                        "儲位": comp.locations || ''
                    });
                });
            });
            const wsBom = XLSX.utils.json_to_sheet(wsBomData);
            XLSX.utils.book_append_sheet(wb, wsBom, "主件總表");
            XLSX.writeFile(wb, `庫存報表_主件總表_${dateStr}.xlsx`);
        } else if (activeTab === 'low_stock') {
            // Sheet 4: Low Stock Summary
            const wsLowStockData = lowStockSummary.map(i => ({
                "元件品號": i.barcode,
                "品名": i.name,
                "規格": i.description,
                "庫存單位": i.unit,
                "庫別名稱": i.category,
                "儲位代碼": i.locations.join('\n'),
                "數量": i.totalQty,
                "安全庫存": i.safe_stock || 0
            }));
            const wsLow = XLSX.utils.json_to_sheet(wsLowStockData);
            XLSX.utils.book_append_sheet(wb, wsLow, "低於安全庫存總表");
            XLSX.writeFile(wb, `庫存報表_低於安全庫存_${dateStr}.xlsx`);
            // Sheet 2: Location Summary
            const ws2Data = locationSummary.flatMap(l =>
                l.items.map(item => ({
                    "樓層": activeFloor,
                    "儲位代碼": l.code,
                    "元件品號": item.barcode,
                    "品名": item.name,
                    "規格": item.description,
                    "庫存單位": item.unit,
                    "庫別名稱": item.category,
                    "數量": item.quantity
                }))
            );
            const ws2 = XLSX.utils.json_to_sheet(ws2Data);
            XLSX.utils.book_append_sheet(wb, ws2, `${activeFloor}儲位總表`);
            XLSX.writeFile(wb, `庫存報表_${activeFloor}_儲位總表_${dateStr}.xlsx`);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <div>
                    <h2 className="text-3xl font-bold text-white">庫存報表</h2>
                    <p className="text-gray-400">查看料件總覽與儲位分佈</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-colors font-bold"
                >
                    <Download size={20} />
                    匯出 Excel
                </button>
            </header>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-700 pb-1">
                <button
                    onClick={() => setActiveTab('item')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-xl transition-colors ${activeTab === 'item'
                        ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <Layers size={18} />
                    料件總表
                </button>
                <button
                    onClick={() => setActiveTab('location')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-xl transition-colors ${activeTab === 'location'
                        ? 'bg-purple-600/20 text-purple-400 border-b-2 border-purple-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <MapPin size={18} />
                    儲位總表
                </button>
                <button
                    onClick={() => setActiveTab('bom')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-xl transition-colors ${activeTab === 'bom'
                        ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <Layers size={18} />
                    主件總表
                </button>
                <button
                    onClick={() => setActiveTab('low_stock')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-t-xl transition-colors ${activeTab === 'low_stock'
                        ? 'bg-red-600/20 text-red-500 border-b-2 border-red-500'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <AlertTriangle size={18} />
                    低於安全庫存總表
                </button>
            </div>

            {/* Sub-tabs for Floors when activeTab === 'location' */}
            {activeTab === 'location' && floors.length > 0 && (
                <div className="flex bg-gray-900 border border-gray-700 p-2 rounded-xl mb-4 gap-2 overflow-x-auto no-scrollbar">
                    {floors.map(floor => (
                        <button
                            key={floor}
                            onClick={() => setActiveFloor(floor)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeFloor === floor
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                        >
                            {floor}
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-gray-800 rounded-b-2xl rounded-tr-2xl border border-gray-700 overflow-hidden shadow-2xl min-h-[500px]">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">載入中...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase">
                                <tr>
                                    {activeTab === 'item' || activeTab === 'low_stock' ? (
                                        <>
                                            <th className="p-4 pl-6">元件品號</th>
                                            <th className="p-4">品名</th>
                                            <th className="p-4">規格</th>
                                            <th className="p-4 text-right">數量</th>
                                            <th className="p-4 text-right">安全庫存</th>
                                            <th className="p-4">儲位分佈</th>
                                        </>
                                    ) : activeTab === 'bom' ? (
                                        <>
                                            <th className="p-4 pl-6">主件品號</th>
                                            <th className="p-4">元件品號</th>
                                            <th className="p-4">組成用量</th>
                                            <th className="p-4 text-right">剩餘庫存</th>
                                            <th className="p-4 text-right">安全庫存</th>
                                            <th className="p-4">所在儲位</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-4 pl-6">儲位代碼</th>
                                            <th className="p-4 text-right">數量</th>
                                            <th className="p-4">存放料件明細</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {activeTab === 'item' || activeTab === 'low_stock' ? (
                                    (activeTab === 'item' ? itemSummary : lowStockSummary).map((item, idx) => (
                                        <motion.tr
                                            key={item.barcode}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="hover:bg-gray-700/30 transition-colors"
                                        >
                                            <td className="p-4 pl-6 font-mono text-blue-400">{item.barcode}</td>
                                            <td className="p-4 font-bold text-white">{item.name}</td>
                                            <td className="p-4 text-gray-400 text-sm">{item.description}</td>
                                            <td className="p-4 text-right pr-6">
                                                <span className="px-3 py-1 rounded-lg font-bold bg-green-600/20 text-green-400">
                                                    {item.totalQty}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <input
                                                    type="number"
                                                    value={item.safe_stock}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setData(prev => prev.map(d => d.barcode === item.barcode ? { ...d, safe_stock: val } : d));
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        updateSafeStock(item.barcode, val).catch(() => alert('更新安全庫存失敗'));
                                                    }}
                                                    className="w-20 px-2 py-1 bg-red-600/20 text-red-500 font-bold text-center rounded-lg border border-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all cursor-pointer hover:bg-red-500/20"
                                                    min="0"
                                                />
                                            </td>
                                            <td className="p-4 text-gray-400 text-sm flex justify-between items-center group">
                                                <div className="flex flex-wrap gap-2">
                                                    {item.locations.map((loc, i) => {
                                                        const match = loc.match(/(.+?)\((.+?)\)/);
                                                        return (
                                                            <span key={i} className="bg-gray-800/80 border border-gray-600 px-2 py-1 rounded text-xs flex items-center shrink-0">
                                                                {match ? (
                                                                    <>
                                                                        <span className="text-blue-300">{match[1]}</span>
                                                                        <span className="text-yellow-500 font-bold ml-[2px]">({match[2]})</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-blue-300">{loc}</span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                {/* Delete Button (Only if Qty is 0) */}
                                                {item.totalQty === 0 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openDeleteModal(item); }}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                                                        title="刪除此料件 (需確認)"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : activeTab === 'bom' ? (
                                    bomData.flatMap((bom) =>
                                        bom.components.map((comp, idx) => (
                                            <motion.tr
                                                key={`${bom.main_barcode}-${comp.component_barcode}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="hover:bg-gray-700/30 transition-colors"
                                            >
                                                <td className="p-4 pl-6 font-mono text-yellow-400 font-bold">{idx === 0 ? bom.main_barcode : ''}</td>
                                                <td className="p-4 font-mono text-blue-400">
                                                    <div>{comp.component_barcode}</div>
                                                    <div className="text-xs text-gray-500">{comp.component_name}</div>
                                                </td>
                                                <td className="p-4 text-white font-bold">{comp.required_qty}</td>
                                                <td className="p-4 text-right">
                                                    <span className={`px-3 py-1 rounded-lg font-bold ${comp.current_stock < comp.required_qty ? 'bg-red-500/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                                                        {comp.current_stock}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right pr-6">
                                                    <span className="px-3 py-1 rounded-lg font-bold bg-red-600/20 text-red-400">
                                                        {comp.safe_stock || 0}
                                                    </span>
                                                </td>
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
                                                        }) : <span className="text-gray-600 text-sm">無庫存</span>}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )
                                ) : (
                                    locationSummary.map((loc, idx) => (
                                        <motion.tr
                                            key={loc.code}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            className="hover:bg-gray-700/30 transition-colors border-b border-gray-800 last:border-b-0"
                                        >
                                            <td className="p-4 pl-6 font-mono text-purple-400 font-bold align-top pt-5">{loc.code}</td>
                                            <td className="p-4 text-right font-bold text-white align-top pt-5">
                                                <span className="px-3 py-1 rounded-lg font-bold bg-green-600/20 text-green-400">
                                                    {loc.totalQuantity}
                                                </span>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-2">
                                                    {loc.items.map((item, i) => (
                                                        <div key={i} className="flex items-center gap-3 bg-gray-800/60 p-2.5 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                                                            <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded font-mono text-xs font-bold border border-blue-500/30">
                                                                {item.barcode}
                                                            </span>
                                                            <span className="text-gray-300 font-bold text-sm">{item.name}</span>
                                                            {item.description && (
                                                                <span className="text-gray-500 text-xs line-clamp-1 max-w-[200px]" title={item.description}>
                                                                    ({item.description})
                                                                </span>
                                                            )}
                                                            <div className="ml-auto inline-flex items-center gap-1.5 shrink-0 bg-gray-900/50 px-2.5 py-1 rounded-md border border-gray-700/50">
                                                                <span className="text-gray-500 text-xs">數量:</span>
                                                                <span className="text-green-400 font-bold">{item.quantity}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gray-800 p-6 rounded-2xl border border-gray-700 max-w-md w-full shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="text-red-500" />
                                確認刪除料件？
                            </h3>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <p className="text-gray-300">
                                您即將刪除料件：<br />
                                <span className="text-blue-400 font-mono font-bold text-lg">{deleteTarget?.barcode}</span>
                                <span className="ml-2 text-white font-bold">{deleteTarget?.name}</span>
                            </p>
                            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 text-sm">
                                此操作無法復原！相關的交易紀錄與庫存將會一併永久刪除。
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">請輸入管理員密碼確認：</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 pr-10 focus:ring-2 focus:ring-red-500 outline-none"
                                        placeholder="輸入密碼..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                                disabled={!deletePassword}
                            >
                                <Trash2 size={18} />
                                確認刪除
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default Reports;
