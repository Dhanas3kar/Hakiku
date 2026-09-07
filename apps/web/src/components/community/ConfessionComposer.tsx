import { useState } from 'react'
import { communityApi } from '../../api/community'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
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

      await queryClient.refetchQueries({
        queryKey: ['confessions'],
      })

      setTimeout(() => {
        setSubmitted(false)
      }, 5000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim() || submitMutation.isPending) {
      return
    }

    setSubmitted(false)
    submitMutation.mutate(content.trim())
  }

  const errorMessage = submitMutation.error
    ? (submitMutation.error as any)?.response?.data?.message ||
    (submitMutation.error as any)?.message ||
    'Failed to submit confession. Please try again later.'
    : null

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">
          🤫
        </div>

        <div>
          <h3 className="font-bold text-foreground">
            Got something to confess?
          </h3>

          <p className="text-xs text-foreground-muted">
            100% Anonymous. No tracking.
          </p>
        </div>
      </div>

      {submitted && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 p-3 text-xs font-medium text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />

          <span>
            Confession posted live! It is now visible in the hero banner.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs font-medium text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />

          <span>
            {Array.isArray(errorMessage)
              ? errorMessage.join(', ')
              : errorMessage}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <MentionTextarea
          value={content}
          onChangeValue={setContent}
          placeholder="Share your deepest campus secrets..."
          maxLength={500}
          className="min-h-[100px] w-full resize-none rounded-xl border-none bg-surface-muted p-3 text-sm text-foreground transition-all placeholder:text-foreground-muted focus:ring-2 focus:ring-primary/50"
          containerClassName="w-full"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <span
              className={`text-xs ${content.length > 500
                  ? 'text-danger'
                  : 'text-foreground-muted'
                }`}
            >
              {content.length}/500
            </span>

            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary sm:px-2 sm:text-[11px]">
              Type @ to tag anyone
            </span>
          </div>

          <button
            type="submit"
            disabled={
              !content.trim() ||
              submitMutation.isPending ||
              content.length > 500
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}

            Submit Anonymously
          </button>
        </div>
      </form>
    </div>
  )
}