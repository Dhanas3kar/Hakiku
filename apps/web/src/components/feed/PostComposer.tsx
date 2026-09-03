import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostVisibility, type PostMedia, type PostItem } from '../../api/posts'
import { communityApi } from '../../api/community'
import { useAuth } from '../../hooks/useAuth'
import { Image, X, Loader2, Globe, Users, Lock, Send, BarChart2, Plus } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

interface PostComposerProps {
  onPostCreated?: (newPost: PostItem) => void
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50 MB

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC')
  const [mediaList, setMediaList] = useState<PostMedia[]>([])
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Poll state
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID())

  const createPostMutation = useMutation({
    mutationFn: async (payload: { content: string; visibility: PostVisibility; mediaUploadIds?: string[]; idempotencyKey: string }) => {
      let pollId: string | undefined = undefined

      // If user is creating a poll, create it first
      const validPollOptions = pollOptions.filter((o) => o.trim().length > 0)
      if (isCreatingPoll && validPollOptions.length >= 2) {
        // Create poll requires a 'question' but in the new flow, the post content IS the context.
        // We'll pass the first 255 chars of content as the poll question for legacy reasons or just use content.
        const pollQuestion = content.trim().substring(0, 255) || 'Poll'
        const poll = await communityApi.createPoll({ question: pollQuestion, options: validPollOptions })
        pollId = poll.id
      }

      return postsApi.createPost({ ...payload, pollId })
    },
    onSuccess: (newPost) => {
      setContent('')
      setMediaList([])
      setUploadError(null)
      setIsCreatingPoll(false)
      setPollOptions(['', ''])
      // Insert the server response into the TanStack Query cache
      queryClient.setQueriesData({ queryKey: ['feed'] }, (old: any) => {
        if (!old || !old.pages || old.pages.length === 0) return old
        const newPages = [...old.pages]
        newPages[0] = {
          ...newPages[0],
          items: [newPost, ...newPages[0].items],
        }
        return {
          ...old,
          pages: newPages,
        }
      })
      if (onPostCreated) {
        onPostCreated(newPost)
      }
    },
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')

    if (!isImage && !isVideo) {
      setUploadError('Only images and videos are supported')
      return
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      setUploadError('Images must be under 10 MB')
      return
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      setUploadError('Videos must be under 50 MB')
      return
    }

    setUploadError(null)
    setIsUploadingMedia(true)

    try {
      const media = await postsApi.uploadMedia(file)
      setMediaList((prev) => [...prev, media])
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload media')
    } finally {
      setIsUploadingMedia(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeMedia = (id: string) => {
    setMediaList((prev) => prev.filter((m) => m.id !== id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && mediaList.length === 0) return

    const currentKey = idempotencyKeyRef.current
    idempotencyKeyRef.current = crypto.randomUUID()

    createPostMutation.mutate({
      content: content.trim(),
      visibility,
      mediaUploadIds: mediaList.map((m) => m.id),
      idempotencyKey: currentKey
    })
  }

  const canSubmit =
    !createPostMutation.isPending &&
    !isUploadingMedia &&
    (content.trim().length > 0 ||
      mediaList.length > 0 ||
      (isCreatingPoll && pollOptions.filter((o) => o.trim().length > 0).length >= 2))

  return (
    <div className="mb-0 sm:mb-2 border-b border-border-subtle bg-surface sm:bg-transparent px-4 py-5 sm:px-1 sm:py-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar + Textarea */}
        <div className="flex items-start gap-3">
          <Avatar
            src={user?.avatarUrl}
            alt={user?.displayName || user?.fullName || 'User'}
            name={user?.displayName || user?.fullName || 'S'}
          />
          <div className="flex-1 min-w-0">
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening on campus?"
              className="w-full resize-none border-none bg-transparent text-[15px] leading-relaxed text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Media Previews */}
        {mediaList.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {mediaList.map((item) => (
              <div
                key={item.id}
                className="relative aspect-video rounded-lg overflow-hidden border border-border bg-surface-muted group"
              >
                {item.type === 'VIDEO' ? (
                  <video src={item.url} className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={item.url}
                    alt="Uploaded media"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(item.id)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-background/80 text-foreground hover:bg-background transition-colors"
                  aria-label="Remove media"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isUploadingMedia && (
          <div className="flex items-center gap-2 text-xs text-primary pt-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading media...</span>
          </div>
        )}

        {uploadError && (
          <p className="text-xs text-danger pt-1" role="alert">
            {uploadError}
          </p>
        )}

        {createPostMutation.isError && (
          <p className="text-xs text-danger pt-1" role="alert">
            {createPostMutation.error.message || 'Failed to create post'}
          </p>
        )}

        {/* Poll UI */}
        {isCreatingPoll && (
          <div className="space-y-3 mt-2 border border-border rounded-md p-4 bg-surface-muted/50">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Poll Options</h4>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingPoll(false)
                  setPollOptions(['', ''])
                }}
                className="text-foreground-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions]
                      newOpts[i] = e.target.value
                      setPollOptions(newOpts)
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="hk-input h-9 flex-1 text-sm"
                    maxLength={50}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                      className="p-1.5 text-foreground-muted hover:text-danger rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 5 && (
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ''])}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors mt-2"
              >
                <Plus className="h-4 w-4" />
                Add option
              </button>
            )}
          </div>
        )}

        {/* Action bar — wraps gracefully on very narrow screens */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
              id="composer-file-input"
            />
            <label
              htmlFor="composer-file-input"
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Image className="h-4 w-4 text-primary" />
              <span className="hidden xs:inline sm:inline">Media</span>
            </label>

            <button
              type="button"
              onClick={() => setIsCreatingPoll(!isCreatingPoll)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer shrink-0 ${
                isCreatingPoll
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
              }`}
            >
              <BarChart2 className={`h-4 w-4 ${isCreatingPoll ? 'text-primary' : 'text-secondary'}`} />
              <span className="hidden xs:inline sm:inline">Poll</span>
            </button>

            {/* Visibility Selector — abbreviated on tiny screens */}
            <div className="relative inline-block text-xs shrink-0">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                className="appearance-none rounded-md border border-border bg-surface pl-2 pr-6 py-1.5 text-xs font-medium text-foreground focus:border-focus focus:outline-none max-w-[90px] sm:max-w-none"
                aria-label="Post visibility"
              >
                <option value="PUBLIC">Public</option>
                <option value="CONNECTIONS_ONLY">Connections</option>
                <option value="PRIVATE">Only Me</option>
              </select>
              <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-foreground-muted">
                {visibility === 'PUBLIC' && <Globe className="h-3 w-3" />}
                {visibility === 'CONNECTIONS_ONLY' && <Users className="h-3 w-3" />}
                {visibility === 'PRIVATE' && <Lock className="h-3 w-3" />}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            loading={createPostMutation.isPending}
            size="sm"
            className="shrink-0"
          >
            {createPostMutation.isPending ? 'Posting...' : 'Post'}
            {!createPostMutation.isPending && <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </form>
    </div>
  )
}