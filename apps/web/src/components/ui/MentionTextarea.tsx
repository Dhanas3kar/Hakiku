import React, { useState, useEffect, useRef } from 'react'
import { profileApi } from '../../api/profile'
import type { UserProfile } from '../../api/profile'
import { Avatar } from './Avatar'
import { VerifiedBadge } from './VerifiedBadge'
import { isUserVerified } from '../../utils/user'
import { Loader2 } from 'lucide-react'



interface MentionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChangeValue: (val: string) => void
  containerClassName?: string
}

export function MentionTextarea({
  value,
  onChangeValue,
  containerClassName = '',
  className = '',
  onKeyDown,
  ...props
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState<number>(-1)
  const [suggestions, setSuggestions] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Check word under cursor for '@' symbol
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    onChangeValue(newVal)

    const cursorPos = e.target.selectionStart
    const textBeforeCursor = newVal.slice(0, cursorPos)
    const words = textBeforeCursor.split(/\s+/)
    const lastWord = words[words.length - 1]

    if (lastWord && lastWord.startsWith('@')) {
      const q = lastWord.slice(1)
      setMentionQuery(q)
      setMentionIndex(cursorPos - lastWord.length)
      setSelectedIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  // Fetch suggestions when mentionQuery is active
  useEffect(() => {
    if (mentionQuery === null) {
      setSuggestions([])
      return
    }

    let active = true
    setLoading(true)

    profileApi.searchProfiles({ query: mentionQuery, limit: 6 })
      .then((res) => {
        if (!active) return
        let items = res.items || []

        // Ensure official admin @hakiku_official is suggested if matching
        const adminMatching = 'hakiku_official'.includes(mentionQuery.toLowerCase()) || 'official'.includes(mentionQuery.toLowerCase())
        const hasAdminInResults = items.some(i => i.username?.toLowerCase() === 'hakiku_official')

        if (adminMatching && !hasAdminInResults) {
          items = [
            {
              id: 'official-admin',
              userId: 'admin-1',
              username: 'hakiku_official',
              displayName: 'HAKIKU Official',
              avatarUrl: null,
              isVerifiedIdentity: true,
              bio: 'Official Admin Account',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as UserProfile,
            ...items
          ]
        }
        setSuggestions(items)
      })
      .catch(() => {
        if (active) setSuggestions([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [mentionQuery])

  const selectUser = (user: UserProfile) => {
    if (!textareaRef.current || mentionIndex === -1) return

    const cursorPos = textareaRef.current.selectionStart
    const before = value.slice(0, mentionIndex)
    const after = value.slice(cursorPos)
    const inserted = `@${user.username} `
    
    const updated = before + inserted + after
    onChangeValue(updated)

    setMentionQuery(null)
    setSuggestions([])

    // Reset cursor focus
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newCursor = mentionIndex + inserted.length
        textareaRef.current.setSelectionRange(newCursor, newCursor)
      }
    }, 10)
  }

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectUser(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }

    onKeyDown?.(e)
  }

  return (
    <div className={`relative ${containerClassName}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDownInternal}
        className={className}
        {...props}
      />

      {/* Autocomplete Popup */}
      {mentionQuery !== null && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-72 rounded-xl border border-border bg-surface shadow-2xl overflow-hidden py-1">
          <div className="px-3 py-1.5 border-b border-border-subtle flex items-center justify-between text-[11px] font-medium text-foreground-muted">
            <span>Tag someone</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </div>

          {suggestions.length === 0 && !loading ? (
            <div className="px-3 py-2 text-xs text-foreground-muted text-center">
              No matching user handles
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {suggestions.map((user, idx) => {
                const isSelected = idx === selectedIndex
                const verified = isUserVerified(user)

                return (
                  <button
                    key={user.id || user.username}
                    type="button"
                    onClick={() => selectUser(user)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors ${
                      isSelected ? 'bg-surface-muted text-foreground' : 'hover:bg-surface-muted/50 text-foreground'
                    }`}
                  >
                    <Avatar src={user.avatarUrl} name={user.displayName || user.username || 'User'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs truncate">
                          {user.displayName || user.username}
                        </span>
                        {verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
                      </div>
                      <span className="text-[11px] text-foreground-subtle truncate block flex items-center gap-1">
                        @{user.username}
                        {verified && <VerifiedBadge className="h-3 w-3 shrink-0" />}
                      </span>
                    </div>
                  </button>
                )
              })}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
