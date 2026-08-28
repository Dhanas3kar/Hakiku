import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export const Route = createFileRoute('/admin/login')({
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/admin/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Invalid admin credentials');
      }

      // Success, redirect to admin dashboard
      navigate({ to: '/admin' });
    } catch (err: any) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-500/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/5 blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-xl mb-2">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Hakiku <span className="text-red-500">Admin</span>
          </h1>
          <p className="text-neutral-400">Restricted Access Only</p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl backdrop-blur-xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@srmist.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800/50 border border-neutral-700 rounded-md text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800/50 border border-neutral-700 rounded-md text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="w-full flex justify-center items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Authenticating...' : 'Secure Login'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-500">
          Unauthorized access is strictly prohibited and logged.
        </p>
      </div>
    </div>
  );
}
