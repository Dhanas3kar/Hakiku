import { cn } from '../../lib/cn'

export function BrandLogo({ className = 'h-8' }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <img
        src="/Dark_theme_logo.png"
        alt="HAKIKU"
        className={cn(className, 'w-auto hidden dark:block')}
      />
      <img
        src="/light_theme_logo.png"
        alt="HAKIKU"
        className={cn(className, 'w-auto block dark:hidden')}
      />
      <span className="sr-only">HAKIKU</span>
    </span>
  )
}
