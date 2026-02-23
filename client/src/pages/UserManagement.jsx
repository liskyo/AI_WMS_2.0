import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api';
import { Users, UserPlus, Edit, Trash, Save, X, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GROUPS = ['管理者', '主管', '生管', '物管', '採購'];
const PERMISSIONS = [
    { id: 'ALL', label: '全功能 (Super Admin)' },
    { id: 'IN', label: '入庫作業' },
    { id: 'OUT', label: '出庫作業' },
    { id: 'VIEW', label: '庫存查詢及報表' },
    { id: 'IMPORT', label: '資料匯入' }
];

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        unit: '', name: '', employee_id: '', group_name: '物管', email: '', password: '', permissions: []
    });
    const [showPassword, setShowPassword] = useState(false);

    // Get token from localStorage
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (token) {
            fetchUsers(token);
        }
    }, [token]);

    const fetchUsers = async (authToken) => {
        try {
            const res = await getUsers(authToken);
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async () => {
        try {
            if (editingUser) {
                await updateUser(editingUser.id, formData, token);
            } else {
                await createUser(formData, token);
            }
            setIsModalOpen(false);
            fetchUsers(token);
            resetForm();
        } catch (err) {
            alert('儲存失敗: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此使用者？')) return;
        try {
            await deleteUser(id, token);
            fetchUsers(token);
        } catch (err) {
            alert('刪除失敗');
        }
    };

    const resetForm = () => {
        setEditingUser(null);
        setFormData({ unit: '', name: '', employee_id: '', group_name: '物管', email: '', password: '', permissions: [] });
    };

    const handlePermissionChange = (permId) => {
        setFormData(prev => {
            if (prev.permissions.includes(permId)) {
                return { ...prev, permissions: prev.permissions.filter(p => p !== permId) };
            } else {
                return { ...prev, permissions: [...prev.permissions, permId] };
            }
        });
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Shield className="text-purple-500" /> 使用者與權限管理
                </h2>
                <button onClick={() => { setIsModalOpen(true); resetForm(); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <UserPlus size={20} /> 新增使用者
                </button>
            </header>

            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left text-gray-300">
                    <thead className="bg-gray-700 text-white">
                        <tr>
                            <th className="p-4">單位</th>
                            <th className="p-4">姓名</th>
                            <th className="p-4">工號</th>
                            <th className="p-4">群組</th>
                            <th className="p-4">權限</th>
                            <th className="p-4">Email</th>
                            <th className="p-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-750">
                                <td className="p-4">{user.unit}</td>
                                <td className="p-4 font-bold text-white">{user.name}</td>
                                <td className="p-4 font-mono">{user.employee_id}</td>
                                <td className="p-4"><span className="bg-gray-700 px-2 py-1 rounded text-sm">{user.group_name}</span></td>
                                <td className="p-4 text-xs max-w-xs truncate">{user.permissions.join(', ')}</td>
                                <td className="p-4 text-sm text-gray-400">{user.email}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => { setEditingUser(user); setFormData({ ...user, password: '' }); setIsModalOpen(true); }} className="text-blue-400 hover:text-blue-300"><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-400 hover:text-red-300"><Trash size={18} /></button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-gray-500">
                                    尚無使用者資料
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-800 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">{editingUser ? '編輯使用者' : '新增使用者'}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div><label className="text-gray-400 text-sm">單位</label><input className="w-full bg-gray-900 border-gray-700 rounded-lg p-2 text-white" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
                                <div><label className="text-gray-400 text-sm">姓名</label><input className="w-full bg-gray-900 border-gray-700 rounded-lg p-2 text-white" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div><label className="text-gray-400 text-sm">工號 (帳號)</label><input className="w-full bg-gray-900 border-gray-700 rounded-lg p-2 text-white" value={formData.employee_id} onChange={e => setFormData({ ...formData, employee_id: e.target.value })} /></div>
                                <div><label className="text-gray-400 text-sm">Email</label><input className="w-full bg-gray-900 border-gray-700 rounded-lg p-2 text-white" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>

                                <div className="col-span-2">
                                    <label className="text-gray-400 text-sm">群組</label>
                                    <select className="w-full bg-gray-900 border-gray-700 rounded-lg p-2 text-white" value={formData.group_name} onChange={e => setFormData({ ...formData, group_name: e.target.value })}>
                                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>

                                <div className="col-span-2 relative">
                                    <label className="text-gray-400 text-sm">密碼 {editingUser && '(若不修改請留空)'}</label>
                                    <input type={showPassword ? "text" : "password"} className="w-full bg-gray-900 border-gray-700 rounded-lg p-2 text-white pr-10" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400 hover:text-white">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="text-gray-400 text-sm block mb-2">權限設定 (多選)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PERMISSIONS.map(perm => (
                                        <label key={perm.id} className="flex items-center gap-2 p-2 rounded bg-gray-700/50 hover:bg-gray-700 cursor-pointer">
                                            <input type="checkbox" checked={formData.permissions.includes(perm.id)} onChange={() => handlePermissionChange(perm.id)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500" />
                                            <span className="text-gray-200 text-sm">{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex justify-center gap-2">
                                <Save /> 儲存變更
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserManagement;
