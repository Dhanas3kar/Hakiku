import React from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, ExternalLink } from 'lucide-react'

interface FormattedContentProps {
  content: string
  className?: string
}

export function FormattedContent({ content, className = '' }: FormattedContentProps) {
  if (!content) return null

  // Split by @username and URLs (http://, https://, www.), preserving the matches
  const parts = content.split(/(@[\w._-]+|https?:\/\/[^\s<]+|www\.[^\s<]+)/g)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1)
          const isOfficialAdmin = username.toLowerCase() === 'hakiku_official'

          return (
            <Link
              key={i}
              to="/profile/$username"
              params={{ username }}
              className={`inline-flex items-baseline gap-0.5 text-primary font-medium hover:underline rounded px-1 py-0.5 ${
                isOfficialAdmin ? 'bg-primary/15 font-semibold text-primary' : 'bg-primary/5'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <span>{part}</span>
              {isOfficialAdmin && (
                <CheckCircle2 className="h-3.5 w-3.5 self-center text-primary fill-primary/20" aria-label="Official Admin" />
              )}
            </Link>
          )
        }

        if (part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.')) {
          const href = part.startsWith('www.') ? `https://${part}` : part

          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline inline-flex items-center gap-0.5 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{part}</span>
              <ExternalLink className="h-3 w-3 inline shrink-0 ml-0.5" />
            </a>
          )
        }
        
        // Handle newlines mapping to <br/>
        const lines = part.split('\n')
        return (
          <React.Fragment key={i}>
            {lines.map((line, j) => (
              <React.Fragment key={j}>
                {line}
                {j < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </React.Fragment>
        )
      })}
    </span>
  )
}
