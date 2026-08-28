import React from 'react'
import { Link } from '@tanstack/react-router'

interface FormattedContentProps {
  content: string
  className?: string
}

export function FormattedContent({ content, className = '' }: FormattedContentProps) {
  if (!content) return null

  // Split by @username, preserving the match
  const parts = content.split(/(@[\w._-]+)/g)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1)
          return (
            <Link
              key={i}
              to="/profile/$username"
              params={{ username }}
              className="text-primary hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
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
