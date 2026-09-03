import { cn } from '../../lib/cn'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<Size, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

interface AvatarProps {
  src?: string | null
  alt?: string
  name?: string
  size?: Size
  className?: string
}

export function Avatar({ src, alt = '', name, size = 'md', className }: AvatarProps) {
  const initial = (name || alt || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-full bg-surface-muted border border-border-subtle',
        sizes[size],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || ''}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-foreground-muted">
          {initial}
        </div>
      )}
    </div>
  )
}
