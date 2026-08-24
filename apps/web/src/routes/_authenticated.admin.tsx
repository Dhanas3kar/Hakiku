import { createFileRoute, Outlet, Link, useRouter } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { Shield, Users, Flag, LayoutDashboard, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && user?.role !== 'ADMIN') {
      router.navigate({ to: '/', replace: true });
    }
  }, [user, status, router]);

  if (status === 'loading' || (status === 'authenticated' && user?.role !== 'ADMIN')) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-200">
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 space-y-4">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xl mb-6">
          <Shield className="w-6 h-6" />
          <span>Admin Center</span>
        </div>
        <nav className="flex flex-col space-y-2">
          <Link
            to="/admin"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors [&.active]:bg-indigo-600 [&.active]:text-white"
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/admin/reports"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors [&.active]:bg-indigo-600 [&.active]:text-white"
          >
            <Flag className="w-5 h-5" />
            <span>Reports</span>
          </Link>
          <Link
            to="/admin/users"
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors [&.active]:bg-indigo-600 [&.active]:text-white"
          >
            <Users className="w-5 h-5" />
            <span>Users</span>
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
