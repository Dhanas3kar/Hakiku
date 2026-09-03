import { Dialog as HuiDialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <HuiDialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[var(--overlay)] transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel
          transition
          className={cn(
            'w-full max-w-lg max-h-[92dvh] overflow-hidden rounded-t-xl sm:rounded-xl border border-border bg-surface shadow-md flex flex-col duration-200 data-closed:translate-y-4 data-closed:opacity-0 sm:data-closed:translate-y-0 sm:data-closed:scale-95',
            className,
          )}
        >
          {title && (
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
              <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {children}
        </DialogPanel>
      </div>
    </HuiDialog>
  )
}
