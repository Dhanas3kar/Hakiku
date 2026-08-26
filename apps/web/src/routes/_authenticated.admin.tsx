import { createFileRoute, Outlet, Link, useRouter } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { Shield, Users, Flag, LayoutDashboard, Loader2, LogOut } from 'lucide-react';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, status, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/admin/auth/logout`, {
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
      <aside className="w-full md:w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col p-4 space-y-4">
        <div className="flex items-center space-x-2 text-red-500 font-bold text-xl mb-6">
          <Shield className="w-6 h-6" />
          <span>Hakiku Admin</span>
        </div>
        <nav className="flex flex-col space-y-2">
          <Link
            to="/admin"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-800 transition-colors [&.active]:bg-red-600 [&.active]:text-white"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/admin/reports"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-800 transition-colors [&.active]:bg-red-600 [&.active]:text-white"
          >
            <Flag className="w-5 h-5" />
            <span>Reports</span>
          </Link>
          <Link
            to="/admin/users"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-800 transition-colors [&.active]:bg-red-600 [&.active]:text-white"
          >
            <Users className="w-5 h-5" />
            <span>Users</span>
          </Link>
        </nav>
        
        <div className="mt-auto pt-4 border-t border-neutral-800">
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
