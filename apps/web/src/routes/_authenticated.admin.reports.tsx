import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { useState } from 'react';
import { Loader2, Flag, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../hooks/useAuth';

export const Route = createFileRoute('/_authenticated/admin/reports')({
  component: AdminReports,
});

function AdminReports() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role === 'ADMIN');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', filter],
    queryFn: () => api.get(`/admin/reports?status=${filter}`),
    enabled: isAdmin,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'DISMISS' | 'REMOVE_CONTENT' }) =>
      api.patch(`/admin/reports/${id}`, { action }),
    onSuccess: () => {
      toast.success('Report resolved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['confessions'] });
      queryClient.invalidateQueries({ queryKey: ['hot_takes'] });
      queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: () => {
      toast.error('Failed to resolve report');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Reports Queue</h1>
        <div className="flex items-center gap-1.5 p-1 bg-surface-muted/60 rounded-xl border border-border self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
              filter === 'PENDING' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
              filter === 'RESOLVED' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilter('DISMISSED')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
              filter === 'DISMISSED' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Dismissed
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted bg-surface rounded-2xl border border-border shadow-sm">
          <Flag className="w-12 h-12 mx-auto mb-4 opacity-50 text-foreground-muted" />
          <p className="font-medium text-sm">No {filter.toLowerCase()} reports found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.data.map((report: any) => (
            <div key={report.id} className="bg-surface border border-border rounded-2xl flex flex-col shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                      report.status === 'PENDING' ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-surface-muted text-foreground-muted'
                    }`}
                  >
                    {report.status}
                  </span>
                  <span className="text-foreground-muted text-xs sm:text-sm font-medium truncate">
                    Target: {report.targetType} ({report.targetId})
                  </span>
                </div>
                <div className="text-xs text-foreground-muted font-medium shrink-0">
                  {new Date(report.createdAt).toLocaleString()}
                </div>
              </div>
              
              <div className="p-4">
                <div className="p-4 bg-surface-muted/50 rounded-xl border border-border/80">
                  <p className="font-bold mb-1 text-xs text-foreground-muted uppercase tracking-wider">Reason reported</p>
                  <p className="text-foreground text-sm leading-relaxed">{report.reason}</p>
                </div>
              </div>

              {report.status === 'PENDING' && (
                <div className="p-4 bg-surface-muted/30 border-t border-border flex flex-wrap justify-end gap-2 sm:gap-3">
                  <button
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: report.id, action: 'DISMISS' })}
                    className="flex items-center px-4 py-2 bg-surface-muted hover:bg-surface-muted/80 text-foreground text-xs sm:text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 border border-border"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Dismiss Report
                  </button>
                  <button
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: report.id, action: 'REMOVE_CONTENT' })}
                    className="flex items-center px-4 py-2 bg-danger hover:bg-danger/90 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Content
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
