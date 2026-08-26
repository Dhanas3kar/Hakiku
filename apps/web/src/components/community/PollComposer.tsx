import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { communityApi } from '../../api/community'
import { Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function PollComposer() {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => communityApi.createPoll({ question, options: options.filter(o => o.trim().length > 0) }),
    onSuccess: () => {
      setQuestion('')
      setOptions(['', ''])
      toast.success('Poll created successfully!')
      queryClient.invalidateQueries({ queryKey: ['polls'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create poll')
    }
  })

  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, ''])
    }
  }

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const isValid = question.trim().length >= 10 && options.filter(o => o.trim().length > 0).length >= 2

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm mb-6">
      <h3 className="text-lg font-bold text-foreground mb-4">Ask a Hot Take</h3>
      
      <div className="space-y-4">
        <div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What's your hot take or question?"
            className="w-full bg-surface-muted border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary resize-none min-h-[80px]"
            maxLength={255}
          />
          <div className="text-right text-xs text-foreground-muted mt-1">
            {question.length}/255
          </div>
        </div>

        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 bg-surface-muted border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:border-primary"
                maxLength={50}
              />
              {options.length > 2 && (
                <button
                  onClick={() => handleRemoveOption(i)}
                  className="p-2 text-foreground-muted hover:text-danger rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 5 && (
          <button
            onClick={handleAddOption}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add option
          </button>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
            className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Post Poll
          </button>
        </div>
      </div>
    </div>
  )
}
