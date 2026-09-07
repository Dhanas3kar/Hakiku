import { useQuery } from '@tanstack/react-query';
import { profileApi } from '../../api/profile';
import { Avatar } from '../ui/Avatar';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { isUserVerified } from '../../utils/user';
import { X, ExternalLink, MessageSquare, GraduationCap, Building2, MapPin } from 'lucide-react';

interface MemberProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberProfileModal({ userId, isOpen, onClose }: MemberProfileModalProps) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', 'user-id', userId],
    queryFn: () => (userId ? profileApi.getByUserId(userId) : null),
    enabled: Boolean(isOpen && userId),
  });

  if (!isOpen || !userId) return null;

  const verified = isUserVerified(profile || undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-2xl transition-all animate-in zoom-in-95 duration-200">
        {/* Header Cover Banner */}
        <div className="relative h-28 bg-gradient-to-r from-primary/80 via-indigo-600 to-purple-700">
          {profile?.coverUrl && (
            <img
              src={profile.coverUrl}
              alt="Cover"
              className="h-full w-full object-cover opacity-80"
            />
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Profile Content Container */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar floating */}
          <div className="-mt-12 mb-3 flex justify-between items-end">
            <div className="rounded-full ring-4 ring-surface shadow-md">
              <Avatar
                src={profile?.avatarUrl}
                name={profile?.displayName || profile?.username || 'Student'}
                size="xl"
              />
            </div>
            {profile && (
              <a
                href={`/profile/${profile.username}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-muted/80 transition-colors"
              >
                <span>Full Profile</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !profile ? (
            <div className="py-6 text-center text-xs text-foreground-muted">
              Profile details not available.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Name & Identity */}
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-foreground truncate">
                    {profile.displayName || profile.fullName}
                  </h3>
                  {verified && <VerifiedBadge className="h-4 w-4 shrink-0" />}
                </div>
                <p className="text-xs font-semibold text-foreground-muted flex items-center gap-1">
                  @{profile.username}
                  {verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
                </p>
              </div>


              {/* Bio */}
              {profile.bio && (
                <p className="text-xs text-foreground/90 leading-relaxed bg-surface-muted/50 p-2.5 rounded-xl border border-border/50">
                  {profile.bio}
                </p>
              )}

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-foreground-muted">
                {profile.department && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{profile.department}</span>
                  </div>
                )}
                {profile.campus && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">{profile.campus}</span>
                  </div>
                )}
                {profile.batchYear && (
                  <div className="flex items-center gap-1.5 truncate col-span-2">
                    <GraduationCap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>Class of {profile.graduationYear || profile.batchYear}</span>
                  </div>
                )}
              </div>

              {/* Skills / Interests */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted block">
                    Skills
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {profile.skills.map((s: { id?: string; name?: string }) => (
                      <span
                        key={s.id || s.name}
                        className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>

                </div>
              )}

              {/* Direct Action */}
              <div className="pt-2">
                <a
                  href={`/messages?userId=${profile.userId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Send Direct Message</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
