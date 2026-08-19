import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4 text-center">
          <div className="mx-auto flex max-w-[400px] flex-col items-center space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Something went wrong</h1>
              <p className="text-sm text-foreground-muted">
                An unexpected error occurred. We've been notified and are looking into it.
              </p>
            </div>
            
            {this.state.error && (
               <div className="w-full rounded-md bg-muted p-3 text-left overflow-x-auto">
                 <p className="text-xs font-mono text-foreground-muted whitespace-pre-wrap break-words">
                   {this.state.error.toString()}
                 </p>
               </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => window.location.href = '/'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <RefreshCcw className="h-4 w-4" />
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
