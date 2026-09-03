import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { useState } from 'react';
import { Loader2, Flag, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/admin/reports')({
  component: AdminReports,
});

function AdminReports() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', filter],
    queryFn: () => api.get(`/admin/reports?status=${filter}`),
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
        <h1 className="text-3xl font-bold text-slate-100">Reports Queue</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'PENDING' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'RESOLVED' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilter('DISMISSED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'DISMISSED' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Dismissed
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
          <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No {filter.toLowerCase()} reports found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data?.data.map((report: any) => (
            <div key={report.id} className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      report.status === 'PENDING' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {report.status}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">
                    Target: {report.targetType} ({report.targetId})
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {new Date(report.createdAt).toLocaleString()}
                </div>
              </div>
              
              <div className="p-4">
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/60">
                  <p className="font-semibold mb-1 text-sm text-slate-400 uppercase tracking-wider">Reason reported</p>
                  <p className="text-slate-200">{report.reason}</p>
                </div>
              </div>

              {report.status === 'PENDING' && (
                <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-end space-x-3">
                  <button
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: report.id, action: 'DISMISS' })}
                    className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Dismiss Report
                  </button>
                  <button
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ id: report.id, action: 'REMOVE_CONTENT' })}
                    className="flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
