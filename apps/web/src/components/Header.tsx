import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center justify-between py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-foreground no-underline"
          >
            <img src="/Dark_theme_logo.png" alt="SRM Connect" className="h-8 w-auto hidden dark:block" />
            <img src="/light_theme_logo.png" alt="SRM Connect" className="h-8 w-auto block dark:hidden" />
            <span className="sr-only">SRM Connect</span>
          </Link>
        </h2>

        <div className="flex w-full items-center gap-4 text-sm font-semibold sm:w-auto">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Home
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
