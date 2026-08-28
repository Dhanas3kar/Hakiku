import { BadgeCheck } from 'lucide-react'

export function VerifiedBadge({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <span aria-label="Verified Official Account" title="Verified Official Account" className="inline-flex items-center align-middle">
      <BadgeCheck
        className={`ml-1 text-white fill-blue-500 ${className}`}
        aria-label="Verified Official Account"
      />
    </span>
  )
}
