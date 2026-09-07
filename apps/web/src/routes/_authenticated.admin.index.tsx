import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { Flag, Users, Activity, TrendingUp } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { useAuth } from '../hooks/useAuth';

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role === 'ADMIN');

  const { data: reportsData } = useQuery({
    queryKey: ['admin', 'reports', 'PENDING'],
    queryFn: () => api.get('/admin/reports?status=PENDING'),
    enabled: isAdmin,
  });

  const { data: pulseData, isLoading: pulseLoading } = useQuery({
    queryKey: ['admin', 'campusPulse'],
    queryFn: () => api.get('/community/campus/pulse'),
    enabled: isAdmin,
  });

  const pendingReports = reportsData?.meta?.total || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground-muted uppercase tracking-wider">
              Pending Reports
            </h3>
            <Flag className="w-4 h-4 text-danger" />
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{pendingReports}</div>
              <p className="text-xs text-foreground-muted mt-1 font-medium">Requires immediate attention</p>
            </div>
            <Link to="/admin/reports" className="text-primary text-xs sm:text-sm font-bold mt-4 inline-block hover:underline">
              View queue &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground-muted uppercase tracking-wider">
              User Management
            </h3>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground">Active</div>
              <p className="text-xs text-foreground-muted mt-1 font-medium">Search and manage accounts</p>
            </div>
            <Link to="/admin/users" className="text-primary text-xs sm:text-sm font-bold mt-4 inline-block hover:underline">
              Manage users &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:col-span-2 md:col-span-1">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground-muted uppercase tracking-wider">
              System Health
            </h3>
            <Activity className="w-4 h-4 text-success" />
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-success">Normal</div>
              <p className="text-xs text-foreground-muted mt-1 font-medium">All services operational</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Pulse Insights */}
      <div className="mt-8 bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-primary">
          <TrendingUp className="w-5 h-5" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Campus Pulse Insights</h2>
        </div>
        
        {pulseLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-muted rounded w-1/4"></div>
            <div className="h-20 bg-surface-muted rounded w-full"></div>
            <div className="h-20 bg-surface-muted rounded w-full"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-surface-muted/40 p-4 rounded-xl border border-border/80">
              <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4">Trending Topics</h3>
              <div className="flex flex-wrap gap-2">
                {pulseData?.trendingTopics?.length > 0 ? (
                  pulseData.trendingTopics.map((topic: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold">
                      {topic}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-foreground-muted">No trending topics right now.</p>
                )}
              </div>
            </div>
            
            <div className="bg-surface-muted/40 p-4 rounded-xl border border-border/80">
              <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wider mb-4">Active Campuses</h3>
              <div className="space-y-3">
                {pulseData?.activeCampuses?.length > 0 ? (
                  pulseData.activeCampuses.map((campus: any, i: number) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm text-foreground font-medium">{campus.name}</span>
                      <span className="text-xs bg-surface border border-border px-2 py-1 rounded-lg text-foreground-muted font-semibold">
                        {campus.activityScore || 0} pts
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-foreground-muted">No campus activity data available.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
