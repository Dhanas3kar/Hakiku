import {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react'
import { X, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type MediaItem = {
  url: string
  type: 'IMAGE' | 'VIDEO'
  alt?: string
  // Optional: add poster, width, height, etc. later
}

interface MediaViewerModalProps {
  media: MediaItem[]
  initialIndex?: number
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 50 // px

// ─── Component ───────────────────────────────────────────────────────────────

function MediaViewerModalComponent({
  media,
  initialIndex = 0,
  onClose,
}: MediaViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, media.length - 1))
  )
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Keep index in bounds if media array changes
  useEffect(() => {
    setCurrentIndex((prev) => Math.max(0, Math.min(prev, media.length - 1)))
  }, [media.length])

  // ── Navigation (stable) ────────────────────────────────────────────────────

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= media.length || index === currentIndex) return
      setIsTransitioning(true)
      setIsLoading(true)
      setHasError(false)
      setCurrentIndex(index)
      // small delay so transition class can apply cleanly
      requestAnimationFrame(() => {
        setTimeout(() => setIsTransitioning(false), 150)
      })
    },
    [media.length, currentIndex]
  )

  const handlePrev = useCallback(() => {
    goTo(currentIndex - 1)
  }, [currentIndex, goTo])

  const handleNext = useCallback(() => {
    goTo(currentIndex + 1)
  }, [currentIndex, goTo])

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent page scroll while modal is open
      if (['ArrowLeft', 'ArrowRight', 'Escape', ' '].includes(e.key)) {
        e.preventDefault()
      }

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          handlePrev()
          break
        case 'ArrowRight':
          handleNext()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrev, handleNext, onClose])

  // ── Body scroll lock + focus management ───────────────────────────────────

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement

    // Lock scroll (more robust than just overflow: hidden)
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'

    // Focus the modal for screen readers / keyboard
    containerRef.current?.focus()

    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)

      // Restore focus
      previousActiveElement.current?.focus()
    }
  }, [])

  // ── Touch / swipe support ──────────────────────────────────────────────────

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return
      const deltaX = e.changedTouches[0].clientX - touchStartX.current
      touchStartX.current = null

      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return
      if (deltaX > 0) handlePrev()
      else handleNext()
    },
    [handlePrev, handleNext]
  )

  // ── Media load handlers ────────────────────────────────────────────────────

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
  }, [])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
  }, [])

  // ── Early exit ─────────────────────────────────────────────────────────────

  if (!media || media.length === 0) return null

  const currentMedia = media[currentIndex]
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < media.length - 1

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm outline-none"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="text-white/90 text-sm font-medium tabular-nums pointer-events-auto select-none">
          {currentIndex + 1} / {media.length}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-2.5 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          aria-label="Close media viewer"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      {/* Prev */}
      {canGoPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handlePrev()
          }}
          className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 p-3 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          aria-label="Previous media"
        >
          <ChevronLeft className="h-8 w-8" strokeWidth={2} />
        </button>
      )}

      {/* Next */}
      {canGoNext && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 p-3 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          aria-label="Next media"
        >
          <ChevronRight className="h-8 w-8" strokeWidth={2} />
        </button>
      )}

      {/* Media area */}
      <div
        className="relative w-full h-full flex items-center justify-center p-4 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading spinner */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <Loader2 className="h-10 w-10 text-white/70 animate-spin" />
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <AlertCircle className="h-12 w-12" />
            <p className="text-sm">Failed to load media</p>
          </div>
        )}

        {/* Actual media */}
        {!hasError && (
          <div
            className={`
              relative max-w-full max-h-full
              transition-opacity duration-150 ease-out
              ${isTransitioning || isLoading ? 'opacity-0' : 'opacity-100'}
            `}
          >
            {currentMedia.type === 'VIDEO' ? (
              <video
                key={currentMedia.url} // force remount on change → clean autoplay
                src={currentMedia.url}
                controls
                autoPlay
                playsInline
                preload="auto"
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
                onLoadedData={handleLoad}
                onError={handleError}
              />
            ) : (
              <img
                key={currentMedia.url}
                src={currentMedia.url}
                alt={currentMedia.alt ?? `Media ${currentIndex + 1} of ${media.length}`}
                loading="eager" // we want it immediately
                decoding="async"
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl select-none"
                onLoad={handleLoad}
                onError={handleError}
                draggable={false}
              />
            )}
          </div>
        )}
      </div>

      {/* Optional: subtle progress dots for small galleries */}
      {media.length > 1 && media.length <= 12 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 pointer-events-none">
          {media.map((_, i) => (
            <div
              key={i}
              className={`
                h-1.5 rounded-full transition-all duration-200
                ${i === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}
              `}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Memoize so parent re-renders don’t recreate the modal unnecessarily
export const MediaViewerModal = memo(MediaViewerModalComponent)