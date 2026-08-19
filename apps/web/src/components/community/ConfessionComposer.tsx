import { useState } from 'react'
import { communityApi } from '../../api/community'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'

export function ConfessionComposer() {
  const [content, setContent] = useState('')
  const queryClient = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: (text: string) => communityApi.submitConfession(text),
    onSuccess: () => {
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['confessions'] })
      // Typically we might optimistically prepend, but since it's anonymous and might have moderation, 
      // simple invalidation is safer. If it's an immediate visible feed, it'll refresh.
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitMutation.isPending) return
    submitMutation.mutate(content.trim())
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl">
          🤫
        </div>
        <div>
          <h3 className="font-bold text-foreground">Got something to confess?</h3>
          <p className="text-xs text-foreground-muted">100% Anonymous. No tracking.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your deepest campus secrets..."
          className="w-full min-h-[100px] resize-none bg-surface-muted border-none rounded-xl p-3 text-sm text-foreground focus:ring-2 focus:ring-primary/50 placeholder:text-foreground-muted transition-all"
        />
        
        <div className="flex justify-end mt-3">
          <button 
            type="submit" 
            disabled={!content.trim() || submitMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background font-medium text-sm rounded-xl hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Anonymously
          </button>
        </div>
      </form>
    </div>
  )
}
