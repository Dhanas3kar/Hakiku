import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] w-full p-6 text-center bg-surface">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4 text-danger">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h3>
          <p className="text-sm text-foreground-muted mb-6 max-w-sm">
            {this.state.error?.message || "An unexpected error occurred while rendering this component."}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
