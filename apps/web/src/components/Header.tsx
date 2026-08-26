import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border dark:border-transparent bg-surface/80 px-4 backdrop-blur-lg shadow-sm dark:shadow-none transition-colors">
      <nav className="page-wrap flex flex-wrap items-center justify-between py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-foreground no-underline"
          >
            <img src="/Dark_theme_logo.png" alt="HAKIKU" className="h-8 w-auto hidden dark:block" />
            <img src="/light_theme_logo.png" alt="HAKIKU" className="h-8 w-auto block dark:hidden" />
            <span className="sr-only">HAKIKU</span>
          </Link>
        </h2>

        {/* Desktop/Mobile top navigation handled by sidebar/bottom nav */}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
