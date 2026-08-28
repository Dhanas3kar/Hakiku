import { BadgeCheck } from 'lucide-react'

export function VerifiedBadge({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <BadgeCheck 
      className={`inline-block ml-1 text-white fill-blue-500 ${className}`}
      title="Verified Official Account"
    />
  )
}
