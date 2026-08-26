import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { Flag, Users, Activity, TrendingUp } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: reportsData } = useQuery({
    queryKey: ['admin', 'reports', 'PENDING'],
    queryFn: () => api.get('/admin/reports?status=PENDING').then((res) => res.data),
  });

  const { data: pulseData, isLoading: pulseLoading } = useQuery({
    queryKey: ['admin', 'campusPulse'],
    queryFn: () => api.get('/community/campus/pulse').then((res) => res.data),
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

      {/* Campus Pulse Insights */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-indigo-400">
          <TrendingUp className="w-5 h-5" />
          <h2 className="text-xl font-bold">Campus Pulse Insights</h2>
        </div>
        
        {pulseLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-1/4"></div>
            <div className="h-20 bg-slate-800 rounded w-full"></div>
            <div className="h-20 bg-slate-800 rounded w-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Trending Topics</h3>
              <div className="flex flex-wrap gap-2">
                {pulseData?.trendingTopics?.length > 0 ? (
                  pulseData.trendingTopics.map((topic: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-sm">
                      {topic}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No trending topics right now.</p>
                )}
              </div>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Active Campuses</h3>
              <div className="space-y-3">
                {pulseData?.activeCampuses?.length > 0 ? (
                  pulseData.activeCampuses.map((campus: any, i: number) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm text-slate-300 font-medium">{campus.name}</span>
                      <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                        {campus.activityScore || 0} pts
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No campus activity data available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
