import { useState } from 'react'
import { communityApi } from '../../api/community'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { MentionTextarea } from '../ui/MentionTextarea'

export function ConfessionComposer() {
  const [content, setContent] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const queryClient = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: (text: string) => communityApi.submitConfession(text),
    onSuccess: async () => {
      setContent('')
      setSubmitted(true)
      await queryClient.refetchQueries({ queryKey: ['confessions'] })
      setTimeout(() => setSubmitted(false), 5000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || submitMutation.isPending) return
    setSubmitted(false)
    submitMutation.mutate(content.trim())
  }

  const errorMessage = submitMutation.error
    ? (submitMutation.error as any)?.response?.data?.message ||
      (submitMutation.error as any)?.message ||
      'Failed to submit confession. Please try again later.'
    : null

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl">
          🤫
        </div>
        <div>
          <h3 className="font-bold text-foreground">Got something to confess?</h3>
          <p className="text-xs text-foreground-muted">100% Anonymous. No tracking.</p>
        </div>
      </div>

      {submitted && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 p-3 text-xs font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Confession posted live! It is now visible in the hero banner.</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/20 p-3 text-xs font-medium text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <MentionTextarea
          value={content}
          onChangeValue={setContent}
          placeholder="Share your deepest campus secrets... Type @ to tag someone"
          maxLength={500}
          className="w-full min-h-[100px] resize-none bg-surface-muted border-none rounded-xl p-3 text-sm text-foreground focus:ring-2 focus:ring-primary/50 placeholder:text-foreground-muted transition-all"
          containerClassName="w-full"
        />
        
        <div className="flex justify-between items-center mt-3">
          <span className={`text-xs ${content.length > 500 ? 'text-danger' : 'text-foreground-muted'}`}>
            {content.length}/500
          </span>
          <button 
            type="submit" 
            disabled={!content.trim() || submitMutation.isPending || content.length > 500}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Anonymously
          </button>
        </div>
      </form>
    </div>
  )
}
