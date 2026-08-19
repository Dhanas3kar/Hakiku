import { useState } from 'react'
import { communityApi } from '../../api/community'
import { useMutation } from '@tanstack/react-query'
import { Loader2, AlertTriangle, X } from 'lucide-react'

interface ReportDialogProps {
  isOpen: boolean
  onClose: () => void
  targetId: string
  targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER'
}

const REPORT_REASONS = [
  'Harassment or Bullying',
  'Hate Speech',
  'Spam or Misleading',
  'Inappropriate Content',
  'Impersonation',
  'Other'
]

export function ReportDialog({ isOpen, onClose, targetId, targetType }: ReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [isSuccess, setIsSuccess] = useState(false)

  const reportMutation = useMutation({
    mutationFn: () => communityApi.reportContent({ 
      targetType, 
      targetId, 
      reason: description ? `${selectedReason}: ${description}` : selectedReason 
    }),
    onSuccess: () => {
      setIsSuccess(true)
      setTimeout(() => {
        onClose()
        setTimeout(() => {
          setIsSuccess(false)
          setSelectedReason('')
          setDescription('')
        }, 300)
      }, 2000)
    }
  })

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={!reportMutation.isPending && !isSuccess ? onClose : undefined} />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-foreground">Report Content</h2>
            </div>
            {!reportMutation.isPending && !isSuccess && (
              <button 
                onClick={onClose}
                className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="p-4">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Report Submitted</h3>
                  <p className="text-sm text-foreground-muted mt-1">
                    Thank you for helping keep the SRM Connect community safe. Our team will review this shortly.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-foreground-muted">
                  Please select a reason for reporting this {targetType.toLowerCase()}. This report will be reviewed by administrators.
                </p>

                <div className="space-y-2">
                  {REPORT_REASONS.map(reason => (
                    <label key={reason} className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors">
                      <input 
                        type="radio" 
                        name="reportReason" 
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="h-4 w-4 text-primary focus:ring-primary border-foreground-muted/30"
                      />
                      <span className="text-sm font-medium text-foreground">{reason}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Additional Details (Optional)</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide any additional context..."
                    className="w-full h-24 resize-none bg-surface border border-border rounded-xl p-3 text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={onClose}
                    disabled={reportMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => reportMutation.mutate()}
                    disabled={!selectedReason || reportMutation.isPending}
                    className="flex items-center justify-center min-w-[100px] px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
