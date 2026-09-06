import { useState, useEffect, useRef } from 'react';
import { createFileRoute, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApi } from '../api/communities';
import { CommunityHeader } from '../components/community/CommunityHeader';
import { ChannelList } from '../components/community/ChannelList';
import { ChannelDrawer } from '../components/community/ChannelDrawer';
import { MessageItem } from '../components/community/MessageItem';
import { MessageComposer } from '../components/community/MessageComposer';
import { EmptyChannelState } from '../components/community/EmptyChannelState';
import { MemberSidebar } from '../components/community/MemberSidebar';
import { MemberDrawer } from '../components/community/MemberDrawer';
import { CommunityInfoSheet } from '../components/community/CommunityInfoSheet';
import { CommunitySettingsModal } from '../components/community/CommunitySettingsModal';
import { Hash, Search } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/communities/$communityId')({
  component: CommunityWorkspacePage,
});

function CommunityWorkspacePage() {
  const { communityId } = useParams({ from: '/_authenticated/communities/$communityId' });
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isChannelDrawerOpen, setIsChannelDrawerOpen] = useState(false);
  const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch Community Details & Channels
  const { data: community, isLoading: isCommLoading } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.getCommunityBySlugOrId(communityId),
  });

  // Fetch Community Members
  const { data: membersList } = useQuery({
    queryKey: ['community', community?.id, 'members'],
    queryFn: () => communitiesApi.getMembers(community!.id),
    enabled: Boolean(community?.id),
  });

  // Default active channel to first channel when loaded
  useEffect(() => {
    if (community?.channels && community.channels.length > 0 && !activeChannelId) {
      setActiveChannelId(community.channels[0].id);
    }
  }, [community, activeChannelId]);

  const activeChannel = community?.channels?.find((c) => c.id === activeChannelId);

  // Fetch Channel Messages
  const { data: messages, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['community', community?.id, 'messages', activeChannelId],
    queryFn: () => communitiesApi.getChannelMessages(community!.id, activeChannelId!),
    enabled: Boolean(community?.id && activeChannelId),
    refetchInterval: 3000, // Poll every 3s for real-time updates
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      communitiesApi.sendChannelMessage(community!.id, activeChannelId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['community', community?.id, 'messages', activeChannelId],
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send message');
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      communitiesApi.createChannel(community!.id, data),
    onSuccess: (newChan) => {
      toast.success(`Channel #${newChan.name} created!`);
      setActiveChannelId(newChan.id);
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create channel');
    },
  });

  const leaveCommunityMutation = useMutation({
    mutationFn: () => communitiesApi.leaveCommunity(community!.id),
    onSuccess: () => {
      toast.success('Left community');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      window.location.href = '/communities';
    },
  });

  const deleteCommunityMutation = useMutation({
    mutationFn: () => communitiesApi.deleteCommunity(community!.id),
    onSuccess: () => {
      toast.success('Community deleted');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      window.location.href = '/communities';
    },
  });

  if (isCommLoading) {
    return (
      <div className="flex h-[calc(100dvh-64px)] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs font-semibold text-foreground-muted">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center p-6 text-center bg-background space-y-4">
        <div className="rounded-3xl bg-surface p-8 border border-border shadow-lg space-y-3 max-w-sm">
          <h2 className="text-base font-bold text-foreground">Community Workspace Not Found</h2>
          <p className="text-xs text-foreground-muted">The requested community may have been removed or is private.</p>
          <a
            href="/communities"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            Back to Discovery
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100dvh-64px)] overflow-hidden bg-background text-foreground pb-14 md:pb-0">
      {/* TOP RESPONSIVE HEADER */}
      <CommunityHeader
        community={community}
        activeChannel={activeChannel}
        onOpenChannels={() => setIsChannelDrawerOpen(true)}
        onOpenMembers={() => setIsMemberDrawerOpen(true)}
        onOpenInfo={() => setIsInfoSheetOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLeaveCommunity={() => leaveCommunityMutation.mutate()}
      />

      {/* MAIN WORKSPACE LAYOUT (3-PANE DESKTOP ≥1200px, 2-PANE TABLET 768-1199px, 1-PANE MOBILE <768px) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* LEFT CHANNEL RAIL (Visible on Tablet & Desktop ≥768px) */}
        <div className="hidden md:flex shrink-0">
          <ChannelList
            community={community}
            activeChannelId={activeChannelId}
            onSelectChannel={(id) => setActiveChannelId(id)}
            onAddChannel={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* CENTER CHAT WORKSPACE (Takes all available remaining width) */}
        <div className="flex flex-1 flex-col min-w-0 bg-surface-muted/40 relative h-full">
          {/* Channel Subheader */}
          <div className="hidden sm:flex h-10 items-center justify-between border-b border-border/80 bg-surface/60 px-4 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-bold text-foreground truncate">{activeChannel?.name || 'general'}</span>
              {activeChannel?.description && (
                <span className="text-foreground-muted truncate">
                  — {activeChannel.description}
                </span>
              )}
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {isMessagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : !messages || messages.length === 0 ? (
              <EmptyChannelState
                channelName={activeChannel?.name}
                onSelectPrompt={(text) => sendMessageMutation.mutate(text)}
              />
            ) : (
              messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Fixed/Sticky Message Composer */}
          <MessageComposer
            channelName={activeChannel?.name}
            onSendMessage={(content) => sendMessageMutation.mutate(content)}
            isSending={sendMessageMutation.isPending}
          />
        </div>

        {/* RIGHT MEMBER RAIL (Visible on Desktop ≥1200px) */}
        <div className="hidden lg:flex shrink-0">
          <MemberSidebar
            members={membersList}
            totalCount={community.memberCount || 1}
          />
        </div>
      </div>

      {/* DRAWERS & MODALS */}

      {/* Mobile Channels Drawer */}
      <ChannelDrawer
        isOpen={isChannelDrawerOpen}
        onClose={() => setIsChannelDrawerOpen(false)}
        community={community}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => setActiveChannelId(id)}
        onAddChannel={() => setIsSettingsOpen(true)}
      />

      {/* Mobile/Tablet Members Drawer */}
      <MemberDrawer
        isOpen={isMemberDrawerOpen}
        onClose={() => setIsMemberDrawerOpen(false)}
        members={membersList}
        totalCount={community.memberCount || 1}
      />

      {/* Community Info Sheet */}
      <CommunityInfoSheet
        isOpen={isInfoSheetOpen}
        onClose={() => setIsInfoSheetOpen(false)}
        community={community}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLeaveCommunity={() => leaveCommunityMutation.mutate()}
      />

      {/* Community Settings / Admin Modal */}
      <CommunitySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        community={community}
        members={membersList}
        onCreateChannel={(name, desc) => createChannelMutation.mutate({ name, description: desc })}
        onDeleteCommunity={() => deleteCommunityMutation.mutate()}
      />
    </div>
  );
}
