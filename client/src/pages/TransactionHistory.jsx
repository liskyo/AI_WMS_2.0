import { useState, useEffect } from 'react';
import api, { voidTransaction } from '../api';
import { Download, Search, Clock, User, Package, MapPin, ArrowDownToLine, ArrowUpFromLine, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const TransactionHistory = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const res = await api.get('/transactions');
            setTransactions(res.data);
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const data = transactions.map(t => ({
            '時間': new Date(t.timestamp).toLocaleString(),
            '動作': t.type === 'IN' ? '入庫' : '出庫',
            '狀態': t.is_deleted ? '已刪除' : '正常',
            '料件條碼': t.barcode,
            '料件名稱': t.item_name,
            '儲位': t.location_code,
            '數量': t.quantity,
            '工號': t.employee_id || '-',
            '經手人': t.user_name || '-',
            '刪除者': t.deleter_name || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, `WMS_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const openDeleteModal = (tx) => {
        setDeleteTarget(tx);
        setAdminPassword('');
        setDeleteError('');
        setShowPassword(false);
        setDeleteModalOpen(true);
    };

    const handleVoid = async () => {
        if (!adminPassword) {
            setDeleteError('請輸入密碼');
            return;
        }
        setIsDeleting(true);
        setDeleteError('');
        try {
            const token = localStorage.getItem('token');
            await voidTransaction(deleteTarget.id, adminPassword, token);
            setDeleteModalOpen(false);
            fetchTransactions(); // Refresh list
        } catch (err) {
            setDeleteError(err.response?.data?.error || '刪除失敗');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredTransactions = transactions.filter(t =>
        t.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.location_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.deleter_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.deleter_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const canDelete = user?.group_name === '管理者' || (user?.permissions && user.permissions.includes('ALL'));

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">出入庫紀錄</h2>
                    <p className="text-gray-400">查看所有詳細的出入庫歷史與經手人員</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Download size={20} /> 匯出 Excel
                    </button>
                </div>
            </header>

            {/* Search */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="搜尋條碼、料件名稱、儲位、工號或姓名..."
                        className="w-full bg-gray-900 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-700 text-gray-400 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium"><div className="flex items-center gap-2"><Clock size={16} /> 時間</div></th>
                                <th className="p-4 font-medium"><div className="flex items-center gap-2">動作</div></th>
                                <th className="p-4 font-medium"><div className="flex items-center gap-2"><Package size={16} /> 料件資訊</div></th>
                                <th className="p-4 font-medium"><div className="flex items-center gap-2"><MapPin size={16} /> 儲位</div></th>
                                <th className="p-4 font-medium text-right">數量</th>
                                <th className="p-4 font-medium"><div className="flex items-center gap-2"><User size={16} /> 經手人</div></th>
                                <th className="p-4 font-medium"><div className="flex items-center gap-2"><User size={16} /> 刪除者</div></th>
                                {canDelete && <th className="p-4 font-medium text-right">操作</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={canDelete ? 8 : 7} className="p-8 text-center text-gray-500">載入中...</td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={canDelete ? 8 : 7} className="p-8 text-center text-gray-500">無符合的紀錄</td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <tr key={t.id} className={clsx("hover:bg-gray-700/30 transition-colors group", t.is_deleted && "opacity-50 bg-red-900/10")}>
                                        <td className="p-4 text-gray-300 whitespace-nowrap text-sm">
                                            {new Date(t.timestamp + (t.timestamp.includes('Z') ? '' : 'Z')).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1",
                                                    t.type === 'IN' ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                                                )}>
                                                    {t.type === 'IN' ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                                                    {t.type === 'IN' ? '入庫' : '出庫'}
                                                </span>
                                                {!!t.is_deleted && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                                        已刪除
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className={clsx("font-bold", t.is_deleted ? "text-gray-400 line-through" : "text-white")}>{t.item_name}</div>
                                            <div className="text-sm text-gray-500 font-mono">{t.barcode}</div>
                                        </td>
                                        <td className="p-4 font-mono text-yellow-400">
                                            {t.location_code}
                                        </td>
                                        <td className="p-4 text-right font-bold text-lg text-white">
                                            {t.quantity}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-gray-300">{t.user_name || '-'}</div>
                                            <div className="text-xs text-gray-500 font-mono">{t.employee_id || '-'}</div>
                                        </td>
                                        <td className="p-4">
                                            {t.is_deleted ? (
                                                <div className="text-red-400 font-bold">{t.deleter_name}</div>
                                            ) : (
                                                <span className="text-gray-600">-</span>
                                            )}
                                        </td>
                                        {canDelete && (
                                            <td className="p-4 text-right">
                                                {!t.is_deleted && (
                                                    <button
                                                        onClick={() => openDeleteModal(t)}
                                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="刪除紀錄 (復原庫存)"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-900 border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                    <AlertTriangle className="text-red-500" />
                                    確認刪除紀錄？
                                </h3>

                                <div className="space-y-4 mb-6">
                                    <p className="text-gray-300">
                                        您即將刪除以下交易紀錄：
                                    </p>
                                    <div className="bg-gray-800 p-4 rounded-lg text-sm border border-gray-700">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-gray-400">料件：</span>
                                            <span className="text-white font-mono">{deleteTarget?.item_name}</span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-gray-400">動作：</span>
                                            <span className={clsx(deleteTarget?.type === 'IN' ? 'text-blue-400' : 'text-orange-400')}>
                                                {deleteTarget?.type === 'IN' ? '入庫' : '出庫'} {deleteTarget?.quantity}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">時間：</span>
                                            <span className="text-gray-400">{new Date(deleteTarget?.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 text-sm">
                                        <p>此操作將會：</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1 opacity-90">
                                            <li>標記此紀錄為「已刪除」</li>
                                            <li><strong>自動復原庫存數量</strong> (反向操作)</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            請輸入管理者密碼確認：
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none pr-10"
                                                value={adminPassword}
                                                onChange={(e) => setAdminPassword(e.target.value)}
                                                placeholder="輸入密碼..."
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        {deleteError && (
                                            <p className="text-red-500 text-sm mt-1">{deleteError}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setDeleteModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                                        disabled={isDeleting}
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleVoid}
                                        disabled={isDeleting || !adminPassword}
                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isDeleting ? '處理中...' : <><Trash2 size={18} /> 確認刪除</>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TransactionHistory;
