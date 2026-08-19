import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostVisibility, type PostMedia, type PostItem } from '../../api/posts'
import { useAuth } from '../../hooks/useAuth'
import { Image, X, Loader2, Globe, Users, Lock, Send } from 'lucide-react'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createPostMutation = useMutation({
    mutationFn: (payload: { content: string; visibility: PostVisibility; mediaUploadIds?: string[] }) =>
      postsApi.createPost(payload),
    onSuccess: (newPost) => {
      setContent('')
      setMediaList([])
      setUploadError(null)
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

    createPostMutation.mutate({
      content: content.trim(),
      visibility,
      mediaUploadIds: mediaList.map((m) => m.id),
    })
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface-elevated p-4 sm:p-5 shadow-xs transition-colors">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-muted border border-border">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName || user.fullName || 'User'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-bold text-foreground-muted">
                {(user?.displayName || user?.fullName || 'S').charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1">
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening on campus?"
              className="w-full resize-none border-none bg-transparent text-sm sm:text-base text-foreground placeholder-foreground-muted focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Media Previews */}
        {mediaList.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {mediaList.map((item) => (
              <div key={item.id} className="relative aspect-video rounded-lg overflow-hidden border border-border bg-surface-muted group">
                {item.type === 'VIDEO' ? (
                  <video src={item.url} className="h-full w-full object-cover" />
                ) : (
                  <img src={item.url} alt="Uploaded media" className="h-full w-full object-cover" />
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
            >
              <Image className="h-4 w-4 text-primary" />
              <span>Media</span>
            </label>

            {/* Visibility Selector */}
            <div className="relative inline-block text-xs">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                className="appearance-none rounded-lg border border-border bg-surface-muted px-3 py-1.5 pr-7 text-xs font-medium text-foreground focus:border-focus focus:outline-none"
              >
                <option value="PUBLIC">Public</option>
                <option value="CONNECTIONS_ONLY">Connections Only</option>
                <option value="PRIVATE">Only Me</option>
              </select>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted">
                {visibility === 'PUBLIC' && <Globe className="h-3 w-3" />}
                {visibility === 'CONNECTIONS_ONLY' && <Users className="h-3 w-3" />}
                {visibility === 'PRIVATE' && <Lock className="h-3 w-3" />}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createPostMutation.isPending || isUploadingMedia || (!content.trim() && mediaList.length === 0)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createPostMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <span>Post</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
