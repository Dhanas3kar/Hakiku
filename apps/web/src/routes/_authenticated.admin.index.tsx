import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { Flag, Users, Activity } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: reportsData } = useQuery({
    queryKey: ['admin', 'reports', 'PENDING'],
    queryFn: () => api.get('/admin/reports?status=PENDING').then((res) => res.data),
  });

  const pendingReports = reportsData?.meta?.total || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">
              Pending Reports
            </h3>
            <Flag className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold">{pendingReports}</div>
            <p className="text-xs text-slate-500 mt-1">Requires immediate attention</p>
            <Link to="/admin/reports" className="text-indigo-400 text-sm mt-4 inline-block hover:underline">
              View queue &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">
              User Management
            </h3>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-slate-500 mt-1">Search and manage accounts</p>
            <Link to="/admin/users" className="text-indigo-400 text-sm mt-4 inline-block hover:underline">
              Manage users &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">
              System Health
            </h3>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-emerald-500">Normal</div>
            <p className="text-xs text-slate-500 mt-1">All services operational</p>
          </div>
        </div>
      </div>
    </div>
  );
}
