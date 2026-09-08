import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, LogOut, Mail, ShieldAlert } from 'lucide-react';
import { formatDistanceToNowStrict, isPast } from 'date-fns';

export function SuspendedScreen() {
  const { user, logout } = useAuth();
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!user?.suspendedUntil) return;

    const end = new Date(user.suspendedUntil);
    const updateTime = () => {
      if (isPast(end)) {
        setTimeLeft('Suspension period has ended. Please refresh.');
      } else {
        setTimeLeft(formatDistanceToNowStrict(end, { addSuffix: false }));
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [user?.suspendedUntil]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-xl p-4 overflow-hidden selection:bg-red-500/30">

      {/* Background ambient glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Main Card */}
      <div className="relative w-full max-w-lg bg-surface/40 backdrop-blur-2xl border border-white/5 shadow-2xl shadow-red-900/20 rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">

        {/* Top Header Section */}
        <div className="relative p-8 text-center flex flex-col items-center justify-center">
          {/* Subtle gradient overlay for header */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent opacity-50 pointer-events-none" />

          {/* Animated Icon Ring */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center group">
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping opacity-75" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 bg-red-500/10 rounded-full blur-md" />
            <div className="relative w-full h-full bg-surface border border-red-500/30 text-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-10 h-10 stroke-[1.5]" />
            </div>
          </div>

          <h2 className="relative text-3xl font-extrabold tracking-tight text-foreground mb-2">
            Account Suspended
          </h2>
          <p className="relative text-foreground-muted text-base max-w-[280px]">
            Your access to Hakiku has been temporarily restricted as you've violated our community guidelines.
          </p>
        </div>

        {/* Content Details */}
        <div className="px-8 pb-8 space-y-6 relative">

          {user?.suspensionReason && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Reason for Suspension
              </h3>
              <div className="bg-background/50 border border-white/5 p-4 rounded-2xl text-foreground text-sm leading-relaxed shadow-inner">
                {user.suspensionReason}
              </div>
            </div>
          )}

          {user?.suspendedUntil && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-widest flex items-center gap-2">
                Time Remaining
              </h3>
              <div className="relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 opacity-50" />
                <div className="bg-background/50 border border-red-500/20 p-6 rounded-2xl text-center relative shadow-inner">
                  <span className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-orange-600 font-mono">
                    {timeLeft || '...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-6 border-t border-white/5 space-y-3">
            <button
              onClick={() => window.location.href = 'mailto:connectxsrm@gmail.com'}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-foreground text-background font-semibold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-foreground/10 text-sm"
            >
              <Mail className="w-4 h-4" />
              Appeal Suspension
            </button>
            <button
              onClick={() => logout.mutate()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-surface hover:bg-surface-hover border border-white/5 text-foreground-muted hover:text-foreground font-semibold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
