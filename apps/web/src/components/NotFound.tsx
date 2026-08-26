import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link to="/" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
          <img src="/Dark_theme_logo.png" alt="HAKIKU" className="h-8 w-auto hidden dark:block" />
          <img src="/light_theme_logo.png" alt="HAKIKU" className="h-8 w-auto block dark:hidden" />
          <span className="sr-only">HAKIKU</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">404 Error</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Page Not Found</h1>
        <p className="mt-4 text-base text-foreground-muted max-w-md">
          Sorry, we could not find the page you are looking for. It might have been moved or deleted.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            to="/"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Return to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
