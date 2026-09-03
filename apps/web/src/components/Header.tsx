import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { BrandLogo } from './ui/BrandLogo'

export default function Header() {
  return (
    <header className="w-full md:hidden sticky top-0 z-50 border-b border-border-subtle bg-surface/90 px-4 backdrop-blur-md">
      <nav className="w-full flex items-center justify-between py-3">
        <Link to="/" className="inline-flex items-center text-foreground no-underline">
          <BrandLogo className="h-7" />
        </Link>
        <ThemeToggle compact />
      </nav>
    </header>
  )
}
