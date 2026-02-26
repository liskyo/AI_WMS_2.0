import { useState, useEffect } from 'react';
import { importItems, importInventory, importLocations, importBom, renameFloor } from '../api';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ShieldCheck, Edit3 } from 'lucide-react';

const ImportPage = () => {
    // Import State
    const [activeTab, setActiveTab] = useState('items'); // 'items' | 'inventory' | 'locations'
    const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', msg: '' }
    const [previewData, setPreviewData] = useState([]);
    const [previewMerges, setPreviewMerges] = useState([]);

    // Map Specific State
    const [floorNameInput, setFloorNameInput] = useState('新大樓4樓');
    const [renameData, setRenameData] = useState({ oldName: '', newName: '', loading: false });

    // Get token from localStorage directly
    const token = localStorage.getItem('token');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            // For locations, we need the raw 2D array to process grid coordinates
            const data = activeTab === 'locations'
                ? XLSX.utils.sheet_to_json(ws, { header: 1 })
                : XLSX.utils.sheet_to_json(ws);

            setPreviewData(data);
            setPreviewMerges(ws['!merges'] || []);
            setImportStatus(null);
        };
        reader.readAsBinaryString(file);
    };

    const executeImport = async () => {
        if (previewData.length === 0) return;

        const isConfirmed = window.confirm(
            "【警告】\n此匯入作業將會更新或完全「覆蓋」現有的資料庫紀錄。\n料件資料會更新現有紀錄，盤點庫存將會完全清空舊庫存並以新檔案為準。\n\n您確定要繼續匯入嗎？"
        );
        if (!isConfirmed) return;

        try {
            let res;
            if (activeTab === 'items') {
                // Map fields if necessary, assuming Excel headers match: barcode, name, category, description
                // If Excel headers are Chinese:
                const formatted = previewData.map(row => ({
                    barcode: row['元件品號'] || row['barcode'],
                    name: row['品名'] || row['name'],
                    description: row['規格'] || row['description'],
                    unit: row['庫存單位'] || row['unit'],
                    category: row['庫別名稱'] || row['category'],
                    safe_stock: row['安全庫存'] !== undefined ? row['安全庫存'] : (row['safe_stock'] || 0)
                })).filter(i => i.barcode && i.name);

                res = await importItems(formatted, token);
            } else if (activeTab === 'bom') {
                // BOM: main_barcode, component_barcode, required_qty
                const formatted = previewData.map(row => ({
                    main_barcode: row['主件品號'] || row['main_barcode'],
                    component_barcode: row['元件品號'] || row['component_barcode'],
                    required_qty: row['組成用量'] || row['required_qty'] || 1
                })).filter(i => i.main_barcode && i.component_barcode);

                res = await importBom(formatted, token);
            } else if (activeTab === 'inventory') {
                // Inventory: barcode, location_code, quantity
                const formatted = previewData.map(row => ({
                    barcode: row['元件品號'] || row['barcode'],
                    item_name: row['品名'] || row['item_name'], // Optional, for auto-create
                    description: row['規格'] || row['description'],
                    location_code: row['儲位代碼'] || row['location_code'],
                    quantity: row['數量'] || row['quantity']
                })).filter(i => i.barcode && i.location_code);

                res = await importInventory(formatted, token);
            } else if (activeTab === 'locations') {
                // Locations: 2D Grid
                const locationsToInsert = [];
                // Excel row is Y, col is X
                previewData.forEach((row, rowIndex) => {
                    if (Array.isArray(row)) {
                        row.forEach((cell, colIndex) => {
                            if (cell && typeof cell === 'string' && cell.trim() !== '') {
                                let code = cell.trim();

                                // 移除防呆機制：如果只是一個孤立的英文字母，且距離左側太遠，那就判定為 Excel 的誤打字元，將其濾除
                                // 這個機制會導致 3 樓平面圖，在右側區域的 A、B 等英文字母標示被濾除，因此將其移除。

                                const isVisual = code.includes('柱') || code.includes('門') || code.includes('走道') || code.includes('圖') || /^[A-Z]$/.test(code);
                                if (isVisual) {
                                    const merge = previewMerges.find(m => m.s.c === colIndex && m.s.r === rowIndex);
                                    const spanX = merge ? (merge.e.c - merge.s.c + 1) : 1;
                                    const spanY = merge ? (merge.e.r - merge.s.r + 1) : 1;
                                    code = `#V_#${code}_${colIndex}_${rowIndex}_${spanX}_${spanY}`;
                                }
                                locationsToInsert.push({
                                    code: code,
                                    x: colIndex,
                                    y: rowIndex
                                });
                            }
                        });
                    }
                });

                if (locationsToInsert.length === 0) throw new Error("無效的儲位圖資料");
                if (!floorNameInput || floorNameInput.trim() === '') throw new Error("請輸入樓層名稱");

                res = await importLocations(locationsToInsert, floorNameInput.trim(), token);
            }

            setImportStatus({ type: 'success', msg: `成功匯入 ${res.data.count} 筆資料！` });
            setPreviewData([]);
        } catch (err) {
            setImportStatus({ type: 'error', msg: '匯入失敗: ' + (err.response?.data?.error || err.message) });
        }
    };

    const handleRenameFloor = async () => {
        if (!renameData.oldName || !renameData.newName) {
            setImportStatus({ type: 'error', msg: '請填寫完整的新舊樓層名稱' });
            return;
        }

        const isConfirmed = window.confirm(`確定將「${renameData.oldName}」修改為「${renameData.newName}」嗎？`);
        if (!isConfirmed) return;

        setRenameData(prev => ({ ...prev, loading: true }));
        try {
            const res = await renameFloor(renameData.oldName.trim(), renameData.newName.trim(), token);
            setImportStatus({ type: 'success', msg: `成功更新了 ${res.data.count} 個儲位歸屬至新樓層名稱！` });
            setRenameData({ oldName: '', newName: '', loading: false });
        } catch (err) {
            setImportStatus({ type: 'error', msg: '修改名稱失敗: ' + (err.response?.data?.error || err.message) });
            setRenameData(prev => ({ ...prev, loading: false }));
        }
    };

    const downloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        let data = [];
        let name = '';

        if (activeTab === 'items') {
            data = [{ "元件品號": "A001", "品名": "測試商品", "規格": "備註/包裝規格", "庫存單位": "個", "庫別名稱": "電子區", "安全庫存": 10 }];
            name = "料件匯入範本.xlsx";
        } else if (activeTab === 'bom') {
            data = [{ "主件品號": "M001", "元件品號": "A001", "品名": "可選(不匯入)", "規格": "可選(不匯入)", "單/複數單位": "單一", "取替代品群組": "Group1", "屬性": "廠內", "組成用量": 2 }];
            name = "主件匯入範本.xlsx";
        } else if (activeTab === 'inventory') {
            data = [{ "元件品號": "A001", "品名": "測試商品", "規格": "備註/包裝規格", "儲位代碼": "4A-01-3", "數量": 10 }];
            name = "盤點匯入範本.xlsx";
        } else {
            // locations
            data = [
                ["", "", "4A-01-3", "4A-02-3"],
                ["", "", "4A-01-2", "4A-02-2"],
                ["", "", "4A-01-1", "4A-02-1"]
            ];
            name = "儲位圖範本.xlsx";
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, "Template");
            XLSX.writeFile(wb, name);
            return; // Quick return for aoa_to_sheet logic
        }

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, name);
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShieldCheck className="text-green-500" />
                        資料匯入中心
                    </h2>
                    <p className="text-gray-400">目前身分：管理員 (Admin)</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Control Panel */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-4">1. 選擇匯入類型</h3>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => { setActiveTab('items'); setPreviewData([]); setImportStatus(null); }}
                                className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${activeTab === 'items'
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <div className="bg-blue-500/20 p-2 rounded-lg"><FileSpreadsheet size={20} /></div>
                                <div className="text-left">
                                    <div className="font-bold">匯入料件主檔</div>
                                    <div className="text-xs opacity-70">建立新料件或更新資訊</div>
                                </div>
                            </button>

                            <button
                                onClick={() => { setActiveTab('bom'); setPreviewData([]); setImportStatus(null); }}
                                className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${activeTab === 'bom'
                                    ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400'
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <div className="bg-yellow-500/20 p-2 rounded-lg"><FileSpreadsheet size={20} /></div>
                                <div className="text-left">
                                    <div className="font-bold">匯入主件主檔</div>
                                    <div className="text-xs opacity-70">建立主件與元件BOM關係</div>
                                </div>
                            </button>

                            <button
                                onClick={() => { setActiveTab('inventory'); setPreviewData([]); setImportStatus(null); }}
                                className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${activeTab === 'inventory'
                                    ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <div className="bg-purple-500/20 p-2 rounded-lg"><FileSpreadsheet size={20} /></div>
                                <div className="text-left">
                                    <div className="font-bold">匯入盤點庫存</div>
                                    <div className="text-xs opacity-70">覆蓋並重置現有庫存</div>
                                </div>
                            </button>

                            <button
                                onClick={() => { setActiveTab('locations'); setPreviewData([]); setImportStatus(null); }}
                                className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${activeTab === 'locations'
                                    ? 'bg-green-600/20 border-green-500 text-green-400'
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <div className="bg-green-500/20 p-2 rounded-lg"><FileSpreadsheet size={20} /></div>
                                <div className="text-left">
                                    <div className="font-bold">匯入儲位地圖</div>
                                    <div className="text-xs opacity-70">更新儲位二維座標配置圖</div>
                                </div>
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-700">
                            <h3 className="text-lg font-bold text-white mb-4">2. 下載範本</h3>
                            <button
                                onClick={downloadTemplate}
                                className="w-full border border-gray-600 hover:bg-gray-700 text-gray-300 py-2 rounded-lg transition-colors text-sm"
                            >
                                下載 Excel 範本 (.xlsx)
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-700">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 px-1">
                                <Edit3 size={18} />
                                3. 管理儲位圖
                            </h3>
                            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl space-y-3">
                                <p className="text-xs text-gray-400 mb-2">修改現有樓層平面圖名稱：</p>
                                <input
                                    type="text"
                                    placeholder="原樓層名稱 (如: 新大樓4樓)"
                                    className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
                                    value={renameData.oldName}
                                    onChange={(e) => setRenameData(prev => ({ ...prev, oldName: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="新樓層名稱 (如: 4F)"
                                    className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-600 text-sm focus:border-blue-500 focus:outline-none"
                                    value={renameData.newName}
                                    onChange={(e) => setRenameData(prev => ({ ...prev, newName: e.target.value }))}
                                />
                                <button
                                    onClick={handleRenameFloor}
                                    disabled={renameData.loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors text-sm font-bold flex justify-center items-center"
                                >
                                    {renameData.loading ? '處理中...' : '確認修改名稱'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upload & Preview */}
                <div className="lg:col-span-2">
                    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 min-h-[500px]">
                        <h3 className="text-lg font-bold text-white mb-4">4. 上傳檔案</h3>

                        {activeTab === 'locations' && (
                            <div className="mb-6 bg-green-900/20 border border-green-500/30 p-4 rounded-xl">
                                <label className="block text-green-400 font-bold mb-2">指定匯入樓層名稱</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition-colors"
                                    placeholder="例如：新大樓4樓、A棟1F..."
                                    value={floorNameInput}
                                    onChange={(e) => setFloorNameInput(e.target.value)}
                                />
                                <p className="text-xs text-gray-400 mt-2">
                                    提示：若樓層名稱與現有資料庫內的相同，將會「覆蓋」該樓層的現有地圖。若名稱不同，則會建立新分頁。
                                </p>
                            </div>
                        )}

                        <div className="relative border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-gray-500 transition-colors bg-gray-900/50">
                            <input
                                type="file"
                                onChange={handleFileUpload}
                                accept=".xlsx, .xls"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Upload className="mx-auto text-gray-500 mb-2" size={32} />
                            <p className="text-gray-400">點擊或拖曳 Excel 檔案至此</p>
                            <p className="text-xs text-gray-600 mt-1">支援 .xlsx, .xls</p>
                        </div>

                        {/* Status Message */}
                        {importStatus && (
                            <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${importStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                {importStatus.type === 'success' ? <CheckCircle /> : <AlertCircle />}
                                {importStatus.msg}
                            </div>
                        )}

                        {/* Preview Table */}
                        {previewData.length > 0 && (
                            <div className="mt-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-400 text-sm">預覽前 5 筆資料 (共 {previewData.length} 筆)</span>
                                    <button
                                        onClick={executeImport}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                                    >
                                        確認匯入
                                    </button>
                                </div>
                                <div className="overflow-x-auto bg-gray-900 rounded-lg">
                                    <table className="w-full text-left text-sm text-gray-400">
                                        {activeTab === 'locations' ? (
                                            <tbody>
                                                {previewData.slice(0, 10).map((row, i) => (
                                                    <tr key={i} className="border-b border-gray-800">
                                                        {row.slice(0, 10).map((val, j) => (
                                                            <td key={j} className="p-3 whitespace-nowrap">{val || ''}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        ) : (
                                            <>
                                                <thead className="bg-gray-700 text-gray-200">
                                                    <tr>
                                                        {Object.keys(previewData[0]).slice(0, 6).map(key => (
                                                            <th key={key} className="p-3">{key}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewData.slice(0, 5).map((row, i) => (
                                                        <tr key={i} className="border-b border-gray-800">
                                                            {Object.values(row).slice(0, 6).map((val, j) => (
                                                                <td key={j} className="p-3">{val}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </>
                                        )}
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportPage;
