import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce'

export interface Tag {
  id: string
  name: string
  category?: string
}

interface TagSelectProps {
  label: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  fetchFn: (query?: string) => Promise<Tag[]>
  placeholder?: string
  initialTags?: Tag[]
}

export function TagSelect({ label, selectedIds, onChange, fetchFn, placeholder, initialTags = [] }: TagSelectProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags)
  
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['tag-search', label, debouncedQuery],
    queryFn: () => fetchFn(debouncedQuery),
    staleTime: 60000,
  })

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync selected tags details from suggestions when initially loading if possible
  // Ideally, we'd fetch the selected tag details explicitly, but for now we just 
  // rely on the user searching for them or passing them in if we need full names.
  // We'll manage just removing by ID. For display, we might just show ID if name isn't fetched,
  // but to fix this, we can maintain the selectedTags list directly from the options clicked.
  
  const handleSelect = (tag: Tag) => {
    if (!selectedIds.includes(tag.id)) {
      setSelectedTags((prev) => [...prev, tag])
      onChange([...selectedIds, tag.id])
    }
    setQuery('')
    setIsOpen(false)
  }

  const handleRemove = (idToRemove: string) => {
    setSelectedTags((prev) => prev.filter((t) => t.id !== idToRemove))
    onChange(selectedIds.filter((id) => id !== idToRemove))
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium mb-1">{label}</label>
      
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <span 
            key={tag.id} 
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm text-primary"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag.id)}
              className="text-primary hover:text-primary/80"
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder || `Search ${label.toLowerCase()}...`}
        className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
      />

      {isOpen && (query.trim() || suggestions.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface-elevated shadow-lg">
          {isLoading ? (
            <div className="p-2 text-sm text-foreground-muted">Loading...</div>
          ) : suggestions.length === 0 ? (
            <div className="p-2 text-sm text-foreground-muted">No results found.</div>
          ) : (
            <ul className="py-1">
              {suggestions.map((tag) => (
                <li
                  key={tag.id}
                  onClick={() => handleSelect(tag)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-surface-muted"
                >
                  {tag.name} {tag.category && <span className="text-xs text-foreground-muted ml-1">({tag.category})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
