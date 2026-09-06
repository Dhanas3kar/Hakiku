import { useState } from 'react';
import { X, Globe, Lock, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: { name: string; description?: string; category?: string; visibility?: string }) => void;
  isPending?: boolean;
}

export function CreateCommunityModal({
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
}: CreateCommunityModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  if (!isOpen) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!name.trim()) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        visibility,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        {/* Header & Step Tracker */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" /> Step {step} of 3
            </div>
            <h2 className="text-xl font-bold text-foreground">Create Campus Community</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleNext} className="space-y-5">
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
                  Community Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js Developers Club"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-surface-muted/60 px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-surface-muted/60 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="General">General</option>
                  <option value="Departments">Departments</option>
                  <option value="AI/ML">AI/ML</option>
                  <option value="Tech & Coding">Tech & Coding</option>
                  <option value="Startups">Startups</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Sports">Sports</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Hackathons">Hackathons</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what your community is about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-surface-muted/60 px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* STEP 2: VISIBILITY */}
          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
                Choose Access & Visibility
              </label>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setVisibility('PUBLIC')}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    visibility === 'PUBLIC'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-surface-muted/40 text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Globe className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Public Community</h4>
                    <p className="text-xs text-foreground-muted leading-relaxed mt-0.5">
                      Open to all verified students across campus. Anyone can discover and join.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility('PRIVATE')}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    visibility === 'PRIVATE'
                      ? 'border-warning bg-warning/10 text-warning shadow-sm'
                      : 'border-border bg-surface-muted/40 text-foreground hover:bg-surface-muted'
                  }`}
                >
                  <Lock className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Private Community</h4>
                    <p className="text-xs text-foreground-muted leading-relaxed mt-0.5">
                      Restricted hub. Only invited students can join channels and discussions.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & LAUNCH */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <span className="text-xs font-bold text-foreground-muted">Community Summary</span>
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Ready
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-base text-foreground">{name}</h4>
                  <p className="text-xs text-foreground-muted">{description || 'No description provided.'}</p>
                </div>

                <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-bold text-foreground-muted">
                  <span className="rounded-md bg-surface px-2 py-1 border border-border">
                    Category: {category}
                  </span>
                  <span className="rounded-md bg-surface px-2 py-1 border border-border">
                    Visibility: {visibility}
                  </span>
                  <span className="rounded-md bg-surface px-2 py-1 border border-border">
                    Default Channel: #general
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold text-foreground-muted hover:bg-surface-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl px-4 py-2.5 text-xs font-semibold text-foreground-muted hover:bg-surface-muted"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isPending || (step === 1 && !name.trim())}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {step < 3 ? (
                <>
                  <span>Continue</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <span>{isPending ? 'Launching...' : 'Create Community'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
