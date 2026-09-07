import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client as api } from '../api/client';
import { useState } from 'react';
import { Loader2, Search, Ban, Unlock } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../hooks/useAuth';

export const Route = createFileRoute('/_authenticated/admin/users')({
  component: AdminUsers,
});

function AdminUsers() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role === 'ADMIN');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [queryInput, setQueryInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api.get(`/admin/users?q=${search}`),
    enabled: isAdmin,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'BANNED' | 'SUSPENDED' }) =>
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
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">User Management</h1>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, username, or email..."
            className="w-full pl-9 pr-4 py-2 bg-surface-muted/60 border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(queryInput)}
          />
        </div>
        <button 
          onClick={() => setSearch(queryInput)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-sm transition-colors shrink-0"
        >
          Search
        </button>
      </div>

      <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-muted/80 text-foreground-muted border-b border-border">
              <tr>
                <th className="px-4 sm:px-6 py-3.5 font-semibold text-xs uppercase tracking-wider">User</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold text-xs uppercase tracking-wider">Email</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold text-xs uppercase tracking-wider">Role</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-32 text-center text-foreground-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                data?.data?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-semibold text-foreground">{user.displayName}</div>
                      <div className="text-xs text-foreground-muted">@{user.username}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-foreground-muted">{user.email}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'ADMIN' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-muted text-foreground-muted'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'BANNED' || user.status === 'SUSPENDED' 
                          ? 'bg-danger/10 text-danger border border-danger/20' 
                          : 'bg-success/10 text-success border border-success/20'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      {user.role !== 'ADMIN' && (
                        user.status === 'BANNED' || user.status === 'SUSPENDED' ? (
                          <button
                            className="inline-flex items-center px-3 py-1.5 border border-success/30 bg-success/10 text-success hover:bg-success/20 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                            onClick={() => statusMutation.mutate({ id: user.id, status: 'ACTIVE' })}
                            disabled={statusMutation.isPending}
                            title="Revoke suspension & restore account access"
                          >
                            <Unlock className="w-3.5 h-3.5 mr-1" /> Revoke Suspension
                          </button>
                        ) : (
                          <button
                            className="inline-flex items-center px-3 py-1.5 border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                            onClick={() => statusMutation.mutate({ id: user.id, status: 'SUSPENDED' })}
                            disabled={statusMutation.isPending}
                            title="Suspend account access for guideline violations"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" /> Suspend Account
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
