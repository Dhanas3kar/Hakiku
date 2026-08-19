import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type PostItem, type PostVisibility } from '../../api/posts'
import { X, Globe, Users, Lock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface EditPostModalProps {
  post: PostItem
  onClose: () => void
}

const VISIBILITY_OPTIONS: { value: PostVisibility; label: string; icon: React.ElementType }[] = [
  { value: 'PUBLIC', label: 'Public', icon: Globe },
  { value: 'CONNECTIONS_ONLY', label: 'Connections', icon: Users },
  { value: 'PRIVATE', label: 'Only Me', icon: Lock },
]

export function EditPostModal({ post, onClose }: EditPostModalProps) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState(post.content || '')
  const [visibility, setVisibility] = useState<PostVisibility>(post.visibility)

  const updateMutation = useMutation({
    mutationFn: () => postsApi.updatePost(post.id, { content, visibility })
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    try {
      await updateMutation.mutateAsync()
      // Invalidate feed to fetch updated post
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      onClose()
    } catch (error) {
      // Show error toast
      toast.error('Failed to update post')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Edit Post</h2>
          <button
            onClick={onClose}
            className="p-2 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[150px] resize-none border-none bg-transparent p-0 text-foreground placeholder:text-foreground-muted focus:ring-0 text-base sm:text-lg"
            placeholder="What do you want to talk about?"
            disabled={updateMutation.isPending}
          />

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="relative">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                disabled={updateMutation.isPending}
                className="appearance-none bg-surface-muted border border-border text-foreground text-sm rounded-full pl-9 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                {(() => {
                  const Icon = VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.icon || Globe
                  return <Icon className="h-4 w-4" />
                })()}
              </div>
            </div>

            <button
              type="submit"
              disabled={!content.trim() || updateMutation.isPending || (content === post.content && visibility === post.visibility)}
              className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-full disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
