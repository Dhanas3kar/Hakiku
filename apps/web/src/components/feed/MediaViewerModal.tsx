import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface MediaViewerModalProps {
  media: any[]
  initialIndex?: number
  onClose: () => void
}

export function MediaViewerModal({ media, initialIndex = 0, onClose }: MediaViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    // Prevent scrolling on body when modal is open
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'auto'
    }
  }, [currentIndex, media.length])

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : prev))
  }

  if (!media || media.length === 0) return null

  const currentMedia = media[currentIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      {/* Header controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-white text-sm font-medium">
          {currentIndex + 1} / {media.length}
        </div>
        <button
          onClick={onClose}
          className="p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Navigation controls */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handlePrev()
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-10"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}
      
      {currentIndex < media.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors z-10"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {/* Content */}
      <div className="w-full h-full flex items-center justify-center p-4 md:p-12" onClick={onClose}>
        <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
          {currentMedia.type === 'VIDEO' ? (
            <video
              src={currentMedia.url}
              controls
              autoPlay
              className="max-h-[85vh] max-w-full object-contain rounded-lg"
            />
          ) : (
            <img
              src={currentMedia.url}
              alt={`Media ${currentIndex + 1}`}
              className="max-h-[85vh] max-w-full object-contain rounded-lg"
            />
          )}
        </div>
      </div>
    </div>
  )
}
