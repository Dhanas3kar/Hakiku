import { createFileRoute, Outlet, Link, useRouter } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { Shield, Users, Flag, LayoutDashboard, Loader2, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { getApiBaseUrl } from '../api/client';

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, status, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${getApiBaseUrl()}/admin/auth/logout`, {
        method: 'POST',
      });
      logout();
      router.navigate({ to: '/admin/login' });
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && user?.role !== 'ADMIN') {
      router.navigate({ to: '/admin/login', replace: true });
    }
  }, [user, status, router]);

  if (status === 'loading' || (status === 'authenticated' && user?.role !== 'ADMIN')) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-neutral-950 text-neutral-200">
      <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col md:flex-col p-4 space-y-3 md:space-y-4 shrink-0">
        <div className="flex items-center justify-between md:justify-start space-x-2 text-red-500 font-bold text-xl mb-2 md:mb-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6" />
            <span>Hakiku Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="md:hidden flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-300 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
        <nav className="flex flex-row md:flex-col overflow-x-auto gap-2 md:gap-0 md:space-y-2 [scrollbar-width:none]">
          <Link
            to="/admin"
            className="flex items-center space-x-2.5 p-2.5 md:p-3 rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap [&.active]:bg-red-600 [&.active]:text-white text-sm font-medium"
          >
            <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/admin/reports"
            className="flex items-center space-x-2.5 p-2.5 md:p-3 rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap [&.active]:bg-red-600 [&.active]:text-white text-sm font-medium"
          >
            <Flag className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span>Reports</span>
          </Link>
          <Link
            to="/admin/users"
            className="flex items-center space-x-2.5 p-2.5 md:p-3 rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap [&.active]:bg-red-600 [&.active]:text-white text-sm font-medium"
          >
            <Users className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span>Users</span>
          </Link>
        </nav>
        
        <div className="hidden md:block mt-auto pt-4 border-t border-neutral-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-3 p-3 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
