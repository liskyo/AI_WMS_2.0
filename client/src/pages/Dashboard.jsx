import MapGrid from '../components/MapGrid';
import { Link } from 'react-router-dom';
import { Package, AlertCircle, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLocations, getItems, getItemDetails, getBom } from '../api';
import * as XLSX from 'xlsx';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalStock: 0,
        occupiedCells: 0,
        emptyCells: 0,
        lowStock: 0
    });
    const [lowStockItems, setLowStockItems] = useState([]);

    // Floor Map State
    const [floors, setFloors] = useState([]);
    const [activeFloor, setActiveFloor] = useState(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null means no search active

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const [locRes, itemsRes] = await Promise.all([getLocations(), getItems()]);
            const locations = Array.isArray(locRes.data) ? locRes.data : [];
            const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];

            // Extract real storage locations (ignore labels, paths, pillars, gates)
            const storageLocations = locations.filter(l => {
                const normalized = (l.code || '').replace(/^#/, '').replace(/#V_.*$/, '');
                return !/^(走道.*|.*儲位圖|[A-Z]|柱|大門)$/.test(normalized.trim());
            });

            // Calculate stats
            const occupied = storageLocations.filter(l => l.total_quantity > 0).length;
            const empty = storageLocations.length - occupied;
            const totalStock = locations.reduce((acc, curr) => acc + (curr.total_quantity || 0), 0);

            // Compute low stock items
            const lowStockList = items.filter(item => item.total_quantity < (item.safe_stock || 0));
            setLowStockItems(lowStockList);

            // Extract floors
            const uniqueFloors = [...new Set(locations.map(l => l.floor).filter(Boolean))];
            if (uniqueFloors.length === 0) uniqueFloors.push('新大樓4樓'); // Fallback default

            // Avoid state overwrite loops; correctly use function setter
            setFloors(prev => JSON.stringify(prev) === JSON.stringify(uniqueFloors) ? prev : uniqueFloors);
            setActiveFloor(prev => prev || uniqueFloors[0]);

            setStats({
                totalStock,
                occupiedCells: occupied,
                emptyCells: empty,
                lowStock: lowStockList.length
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
    };

    // Auto-search effect with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim()) {
                executeSearch();
            } else {
                setSearchResults(null);
            }
        }, 500); // 500ms delay to wait for typing/scanning to finish

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const executeSearch = async () => {
        if (!searchQuery.trim()) return;

        try {
            // 1. Try fetching BOM first
            const bomRes = await getBom(searchQuery);
            if (bomRes.data && bomRes.data.length > 0) {
                const matched = bomRes.data.find(b => b.main_barcode === searchQuery) || bomRes.data[0];

                // Group components by location for MapGrid tooltip
                const locMap = {};
                matched.components.forEach(comp => {
                    if (comp.locations) {
                        const locs = comp.locations.split(',');
                        locs.forEach(loc => {
                            const [trimmedLoc, qtyStr] = loc.trim().split(':');
                            if (!trimmedLoc) return;
                            if (!locMap[trimmedLoc]) locMap[trimmedLoc] = [];
                            locMap[trimmedLoc].push({
                                barcode: comp.component_barcode,
                                name: comp.component_name,
                                stock: parseInt(qtyStr, 10) || 0
                            });
                        });
                    }
                });

                const highlights = Object.keys(locMap).map(code => ({
                    location_code: code,
                    components: locMap[code]
                }));

                setSearchResults({ type: 'BOM', data: matched, highlights });
                return;
            }
        } catch (err) {
            console.warn("BOM Search failed, falling back to Item details");
        }

        try {
            // 2. Fallback to normal Item details
            const res = await getItemDetails(searchQuery);
            setSearchResults({ type: 'ITEM', data: res.data.item, highlights: res.data.inventory });
        } catch (err) {
            setSearchResults(null);
        }
    };

    const exportPurchaseList = () => {
        if (lowStockItems.length === 0) return;
        const data = lowStockItems.map(item => ({
            "料件條碼": item.barcode,
            "品名": item.name,
            "規格": item.description || '',
            "庫存單位": item.unit || '',
            "總庫存量": item.total_quantity,
            "安全庫存": item.safe_stock || 0,
            "建議採購量": Math.max(0, (item.safe_stock || 0) - item.total_quantity)
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "建議採購清單");
        XLSX.writeFile(wb, "建議採購清單.xlsx");
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white">總覽看板</h2>
                    <p className="text-gray-400">即時監控庫存狀態與儲位分佈</p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="text-gray-500" size={20} />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearch}
                        placeholder="掃描或輸入料件條碼搜尋 (自動顯示)..."
                        className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchQuery && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-white" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>
                            ✕
                        </div>
                    )}
                </div>
            </header>

            {/* Low Stock Alert Section */}
            {lowStockItems.length > 0 && (
                <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 shadow-lg shadow-red-500/5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="text-red-500 shrink-0" size={28} />
                            <div>
                                <h3 className="text-xl font-bold text-red-500">安全庫存警示</h3>
                                <p className="text-red-400 mt-1">系統偵測到 {lowStockItems.length} 項料件的總庫存低於設定的安全庫存量，請及早備料。</p>
                            </div>
                        </div>
                        <button
                            onClick={exportPurchaseList}
                            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow shrink-0 whitespace-nowrap"
                        >
                            匯出建議採購清單
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Link to="/reports?tab=item" className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg hover:border-blue-500 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-gray-400 text-sm group-hover:text-blue-400 transition-colors">庫存總數</h3>
                            <p className="text-2xl font-bold text-white">{stats.totalStock}</p>
                        </div>
                    </div>
                </Link>
                <Link to="/reports?tab=location" className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg hover:border-green-500 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/20 rounded-lg text-green-400 group-hover:bg-green-500/30 transition-colors">
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-gray-400 text-sm group-hover:text-green-400 transition-colors">佔用儲位</h3>
                            <p className="text-2xl font-bold text-white">{stats.occupiedCells}</p>
                        </div>
                    </div>
                </Link>
                <Link to="/reports?tab=location" className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg hover:border-teal-500 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-500/20 rounded-lg text-teal-400 group-hover:bg-teal-500/30 transition-colors">
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-gray-400 text-sm group-hover:text-teal-400 transition-colors">空置儲位</h3>
                            <p className="text-2xl font-bold text-white">{stats.emptyCells}</p>
                        </div>
                    </div>
                </Link>
                <Link to="/reports?tab=low_stock" className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg hover:border-red-500 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/20 rounded-lg text-red-400 group-hover:bg-red-500/30 transition-colors">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <h3 className="text-gray-400 text-sm group-hover:text-red-400 transition-colors">低庫存警示</h3>
                            <p className="text-2xl font-bold text-white">{stats.lowStock}</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Search Results Summary */}
            {searchResults && searchResults.type === 'BOM' && (
                <div className="bg-gray-800 p-6 rounded-xl border border-yellow-500 shadow-lg">
                    <h3 className="text-xl font-bold text-yellow-400 mb-4">
                        📦 主件搜尋結果: {searchResults.data.main_barcode}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.data.components.map((comp, idx) => (
                            <div key={idx} className="bg-gray-900 border border-gray-700 p-4 rounded-lg">
                                <div className="text-blue-400 font-bold mb-1">{comp.component_barcode}</div>
                                <div className="text-sm text-gray-400 truncate mb-2">{comp.component_name}</div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">庫存: <span className={comp.current_stock < comp.required_qty ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{comp.current_stock}</span></span>
                                    <span className="text-gray-500">單套用量: <span className="text-white">{comp.required_qty}</span></span>
                                </div>
                                <div className="text-xs text-green-500 mt-2 font-mono">
                                    儲位: {comp.locations ? comp.locations.split(',').map(l => l.split(':')[0]).join(',') : '無'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Map */}
            <section>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-xl font-semibold text-white truncate">平面圖</h3>

                        {/* Floor Tabs */}
                        {floors.length > 0 && (
                            <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700 overflow-x-auto max-w-full no-scrollbar">
                                {floors.map(floor => (
                                    <button
                                        key={floor}
                                        onClick={() => setActiveFloor(floor)}
                                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeFloor === floor
                                                ? 'bg-blue-600 text-white shadow'
                                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                            }`}
                                    >
                                        {floor}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {searchResults && searchResults.highlights && (
                        <span className="text-sm px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/50 whitespace-nowrap">
                            🔍 搜尋結果: 找到 {searchResults.highlights.length} 個相關料架
                        </span>
                    )}
                </div>
                <MapGrid highlights={searchResults ? searchResults.highlights : null} activeFloor={activeFloor} />
            </section>
        </div>
    );
};

export default Dashboard;
