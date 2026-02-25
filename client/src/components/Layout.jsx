import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, ArrowRightLeft, Package, User, FileBarChart, Settings, Shield, LogOut, History, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const Layout = () => {
    const location = useLocation();
    const { user, logout } = useAuth();

    // Helper to check permissions
    const hasPermission = (required) => {
        if (!user) return false;
        // 'ALL' permission or specific permission match
        // Note: permissions is an array of strings
        if (user.permissions && user.permissions.includes('ALL')) return true;
        return user.permissions && user.permissions.includes(required);
    };

    const navItems = [
        { path: '/dashboard', label: '總覽 (地圖)', icon: LayoutDashboard, visible: true },
        { path: '/operations', label: '出入庫作業', icon: ArrowRightLeft, visible: hasPermission('IN') || hasPermission('OUT') },
        { path: '/history', label: '出入庫紀錄', icon: History, visible: hasPermission('VIEW') },
        { path: '/inventory', label: '庫存查詢', icon: Package, visible: hasPermission('VIEW') },
        { path: '/reports', label: '庫存報表', icon: FileBarChart, visible: hasPermission('VIEW') },
        { path: '/import', label: '資料匯入', icon: Settings, visible: hasPermission('IMPORT') },
        { path: '/users', label: '人員管理', icon: Shield, visible: user?.group_name === '管理者' || hasPermission('ALL') },
    ];

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-2xl font-bold text-blue-500 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        WMS 系統
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">智慧倉儲管理</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.filter(item => item.visible).map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                )}
                            >
                                <Icon size={20} className={clsx(isActive ? 'text-white' : 'text-gray-500 group-hover:text-white')} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-xl mb-2">
                        <div className="bg-blue-500/20 p-2 rounded-full text-blue-400">
                            <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{user?.name || 'User'}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.group_name || 'Staff'}</p>
                        </div>
                    </div>
                    <Link
                        to="/mobile"
                        className="w-full flex items-center gap-2 text-teal-400 font-bold hover:text-white bg-teal-500/10 p-3 rounded-lg transition-colors hover:bg-teal-500/30 mb-2 shadow-sm border border-teal-500/20"
                    >
                        <Smartphone size={18} />
                        <span className="text-sm flex-1 text-center pr-2">切換至手機掃描模式</span>
                    </Link>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-400 p-2 rounded-lg transition-colors hover:bg-red-500/10"
                    >
                        <LogOut size={18} />
                        <span className="text-sm">登出系統</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gray-950 p-8 relative">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div className="relative z-10 w-full mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
