import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { useState } from 'react';
import { Loader2, Search, Ban, Unlock } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/admin/users')({
  component: AdminUsers,
});

function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [queryInput, setQueryInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api.get(`/admin/users?q=${search}`).then((res) => res.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'BANNED' }) =>
      api.patch(`/admin/users/${id}/status`, { status, reason: 'Admin action' }),
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user');
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-100">User Management</h1>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, username, or email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(queryInput)}
          />
        </div>
        <button 
          onClick={() => setSearch(queryInput)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          Search
        </button>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-32 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                data?.data?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{user.displayName}</div>
                      <div className="text-xs text-slate-500">@{user.username}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'BANNED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role !== 'ADMIN' && (
                        user.status === 'BANNED' ? (
                          <button
                            className="inline-flex items-center px-3 py-1.5 border border-emerald-900/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                            onClick={() => statusMutation.mutate({ id: user.id, status: 'ACTIVE' })}
                            disabled={statusMutation.isPending}
                          >
                            <Unlock className="w-3.5 h-3.5 mr-1" /> Restore
                          </button>
                        ) : (
                          <button
                            className="inline-flex items-center px-3 py-1.5 border border-rose-900/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                            onClick={() => statusMutation.mutate({ id: user.id, status: 'BANNED' })}
                            disabled={statusMutation.isPending}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
