import { type CommunityMember } from '../../api/communities';
import { MemberSidebar } from './MemberSidebar';
import { X, Users } from 'lucide-react';

interface MemberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  members?: CommunityMember[];
  totalCount?: number;
}

export function MemberDrawer({
  isOpen,
  onClose,
  members = [],
  totalCount = 1,
}: MemberDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 h-full w-72 max-w-[85vw] border-l border-border bg-surface shadow-2xl animate-in slide-in-from-right duration-250">
        <MemberSidebar members={members} totalCount={totalCount} onClose={onClose} />
      </div>
    </div>
  );
}
