import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { confessionsApi, type HeroConfession } from '../../api/confessions'
import { useAuth } from '../../hooks/useAuth'
import {
  MessageSquarePlus,
  ArrowRight,
  Clock,
  X,
  Heart,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { ConfessionComposer } from '../community/ConfessionComposer'
import { Dialog } from '../ui/Dialog'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'

export interface ConfessionHeroProps {
  mode?: 'static' | 'carousel'
  customImages?: string[]
}

/* ─── local SRM campus photographs ─── */
const FALLBACK_CAMPUS_IMAGES = [
  '/images/Campus-gallery (1).jpeg',
  '/images/Campus-gallery (1).jpg',
  '/images/Campus-gallery (1).png',
  '/images/Campus-gallery (1).webp',
  '/images/Campus-gallery (10).jpg',
  '/images/Campus-gallery (11).jpg',
  '/images/Campus-gallery (12).jpg',
  '/images/Campus-gallery (13).jpg',
  '/images/Campus-gallery (14).jpg',
  '/images/Campus-gallery (15).jpg',
  '/images/Campus-gallery (16).jpg',
  '/images/Campus-gallery (17).jpg',
  '/images/Campus-gallery (2).jpeg',
  '/images/Campus-gallery (2).jpg',
  '/images/Campus-gallery (2).webp',
  '/images/Campus-gallery (3).jpg',
  '/images/Campus-gallery (3).webp',
  '/images/Campus-gallery (4).jpg',
  '/images/Campus-gallery (5).jpg',
  '/images/Campus-gallery (6).jpg',
  '/images/Campus-gallery (7).jpg',
  '/images/Campus-gallery (8).jpg',
  '/images/Campus-gallery (9).jpg',
]

/* last-resort image if every source in the pool fails to load */
const ULTIMATE_FALLBACK_IMAGE = '/images/Campus-gallery (1).jpg'

/* ─── motion settings ─── */
const fadeVariants = {
  initial: { opacity: 0, y: 8, scale: 0.99 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.99,
    transition: { duration: 0.25, ease: 'easeInOut' as const },
  },
}

/** safe modulo that never divides by zero / never returns NaN */
function safeMod(value: number, length: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(length) || length <= 0) return 0
  return ((value % length) + length) % length
}

export function ConfessionHero({ customImages }: ConfessionHeroProps) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedConfessionId, setSelectedConfessionId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // remember what triggered a modal open so focus can return to it on close
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  const {
    data: result,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['confessions', 'hero'],
    queryFn: () => confessionsApi.getHeroConfession(),
    enabled: isAuthenticated,
    staleTime: 5 * 1000,
    retry: 2,
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : 10 * 1000,
  })

  const upvoteMutation = useMutation({
    mutationFn: (id: string) => confessionsApi.upvoteConfession(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['confessions', 'hero'] })
      const previousData = queryClient.getQueryData<{
        items: HeroConfession[]
        isFallback: boolean
      }>(['confessions', 'hero'])

      if (previousData?.items) {
        queryClient.setQueryData(['confessions', 'hero'], {
          ...previousData,
          items: (previousData?.items || []).map((item) => {
            if (item.id === id) {
              const currentlyUpvoted = item.isUpvoted
              const currentCount = item.upvoteCount || 0
              return {
                ...item,
                isUpvoted: !currentlyUpvoted,
                upvoteCount: currentlyUpvoted
                  ? Math.max(0, currentCount - 1)
                  : currentCount + 1,
              }
            }
            return item
          }),
        })
      }

      return { previousData }
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['confessions', 'hero'], context.previousData)
      }
    },
    onSuccess: (data, id) => {
      if (data?.upvoteCount !== undefined && data?.isUpvoted !== undefined) {
        queryClient.setQueryData<{ items: HeroConfession[]; isFallback: boolean }>(
          ['confessions', 'hero'],
          (old) => {
            if (!old?.items) return old
            return {
              ...old,
              items: old.items.map((item) =>
                item.id === id
                  ? { ...item, isUpvoted: data.isUpvoted, upvoteCount: data.upvoteCount }
                  : item,
              ),
            }
          },
        )
      }
    },
  })

  // Defensive parsing: tolerate malformed dates, missing fields, non-array payloads
  const confessions = useMemo(() => {
    const rawConfessions = Array.isArray(result?.items) ? result.items : []
    return rawConfessions.filter((item): item is HeroConfession => {
      if (!item || typeof item !== 'object' || !item.id) return false
      const pubDate = item.publishedAt || item.createdAt
      if (!pubDate) return true
      const timestamp = new Date(pubDate).getTime()
      if (Number.isNaN(timestamp)) return true
      return Date.now() - timestamp < 24 * 60 * 60 * 1000
    })
  }, [result?.items])

  const imagePool = useMemo(() => {
    const pool = customImages && customImages.length > 0 ? customImages : FALLBACK_CAMPUS_IMAGES
    return pool.length > 0 ? pool : [ULTIMATE_FALLBACK_IMAGE]
  }, [customImages])

  // Keep activeIndex/imageIndex in bounds whenever the underlying arrays change size
  useEffect(() => {
    setActiveIndex((prev) => (confessions.length === 0 ? 0 : safeMod(prev, confessions.length)))
  }, [confessions.length])

  useEffect(() => {
    setImageIndex((prev) => safeMod(prev, imagePool.length))
  }, [imagePool.length])

  // Preload images defensively, track failures, and clean up properly on unmount
  useEffect(() => {
    let cancelled = false
    const loaders: HTMLImageElement[] = []

    imagePool.forEach((src) => {
      const img = new Image()
      img.onerror = () => {
        if (cancelled) return
        setFailedImages((prev) => {
          if (prev.has(src)) return prev
          const next = new Set(prev)
          next.add(src)
          return next
        })
      }
      img.src = src
      loaders.push(img)
    })

    return () => {
      cancelled = true
      loaders.forEach((img) => {
        img.onload = null
        img.onerror = null
        img.src = ''
      })
    }
  }, [imagePool])

  // silent rotation when not hovered — pauses when the tab isn't visible, and
  // is torn down cleanly on unmount so it can never fire against an unmounted component
  useEffect(() => {
    if (isHovered) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    const timer = window.setInterval(() => {
      setImageIndex((prev) => safeMod(prev + 1, imagePool.length))
      if (confessions.length > 1) {
        setActiveIndex((prev) => safeMod(prev + 1, confessions.length))
      }
    }, 6000)

    return () => window.clearInterval(timer)
  }, [isHovered, imagePool.length, confessions.length])

  // pause/resume autoplay based on tab visibility, independent of hover state
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsHovered(true) // reuse the pause path
      } else {
        setIsHovered(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handlePrev = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation()
      if (confessions.length === 0) return
      setActiveIndex((prev) => safeMod(prev - 1, confessions.length))
      setImageIndex((prev) => safeMod(prev - 1, imagePool.length))
    },
    [confessions.length, imagePool.length],
  )

  const handleNext = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation()
      if (confessions.length === 0) return
      setActiveIndex((prev) => safeMod(prev + 1, confessions.length))
      setImageIndex((prev) => safeMod(prev + 1, imagePool.length))
    },
    [confessions.length, imagePool.length],
  )

  const openConfession = useCallback((id: string, trigger?: HTMLElement | null) => {
    lastFocusedRef.current = trigger ?? (document.activeElement as HTMLElement | null)
    setSelectedConfessionId(id)
  }, [])

  const closeConfession = useCallback(() => {
    setSelectedConfessionId(null)
  }, [])

  // Escape key + body scroll lock + focus handling for the detail modal
  useEffect(() => {
    if (!selectedConfessionId) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfession()
    }
    document.addEventListener('keydown', handleKeyDown)

    // move focus into the modal
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      window.clearTimeout(focusTimer)
      // return focus to whatever opened the modal
      lastFocusedRef.current?.focus?.()
    }
  }, [selectedConfessionId, closeConfession])

  if (isLoading) {
    return (
      <div
        className="
          relative mb-0 w-full overflow-hidden rounded-none
          border-b border-border-subtle bg-surface-elevated
          min-h-[220px] sm:min-h-[250px]
          p-6 flex flex-col justify-between animate-pulse
        "
        aria-busy="true"
        aria-label="Loading campus confession"
      >
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 rounded-full bg-surface-muted" />
          <div className="h-8 w-24 rounded-full bg-surface-muted" />
        </div>
        <div className="space-y-3 py-3">
          <div className="h-7 w-11/12 rounded-xl bg-surface-muted" />
          <div className="h-7 w-3/4 rounded-xl bg-surface-muted" />
          <div className="h-4 w-32 rounded-lg bg-surface-muted mt-2" />
        </div>
        <div className="flex justify-between items-center">
          <div className="h-8 w-20 rounded-full bg-surface-muted" />
          <div className="h-4 w-28 rounded-lg bg-surface-muted" />
        </div>
      </div>
    )
  }

  const currentConfession = confessions[activeIndex] ?? null
  // Derive the modal confession live from the cache (never stale)
  const selectedConfession = selectedConfessionId
    ? confessions.find((c) => c.id === selectedConfessionId) ?? null
    : null

  const preferredBg = currentConfession?.imageUrl
  const poolBg = imagePool[safeMod(imageIndex, imagePool.length)]
  const bgImage =
    preferredBg && !failedImages.has(preferredBg)
      ? preferredBg
      : !failedImages.has(poolBg)
        ? poolBg
        : ULTIMATE_FALLBACK_IMAGE

  return (
    <>
      {/* ── Outer Wrapper ── */}
      <div className="relative mb-0 w-full group overflow-hidden">
        {/* ── Main Editorial Card ── */}
        <div
          className="
            relative w-full overflow-hidden rounded-none
            border-b border-border-subtle
            bg-surface-elevated shadow-md
            transition-all duration-300
            min-h-[230px] sm:min-h-[260px]
            flex flex-col justify-between
            select-none cursor-pointer
          "
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) =>
            currentConfession && openConfession(currentConfession.id, e.currentTarget)
          }
          role="button"
          tabIndex={currentConfession ? 0 : -1}
          onKeyDown={(e) => {
            if (!currentConfession) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openConfession(currentConfession.id, e.currentTarget)
            }
          }}
          aria-label={currentConfession ? 'Open confession details' : undefined}
        >
          {/* Photographic background with smooth crossfade */}
          <AnimatePresence>
            <motion.img
              key={bgImage}
              src={bgImage}
              alt="Campus atmosphere"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              className="
                absolute inset-0 h-full w-full
                object-cover object-center
                pointer-events-none
                transition-transform duration-700 ease-out
                group-hover:scale-105
              "
              aria-hidden="true"
              onError={() => {
                setFailedImages((prev) => {
                  if (prev.has(bgImage)) return prev
                  const next = new Set(prev)
                  next.add(bgImage)
                  return next
                })
              }}
            />
          </AnimatePresence>

          {/* Premium multi-stop contrast gradient overlay */}
          <div
            className="
              absolute inset-0
              bg-gradient-to-t from-black/90 via-black/60 to-black/40
              pointer-events-none
            "
            aria-hidden="true"
          />

          {/* ── Card Header ── */}
          <div className="relative z-10 flex items-center justify-between p-5 sm:p-6 pb-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <span
                className="
                  text-[11px] sm:text-xs font-bold
                  uppercase tracking-widest
                  text-white/90 drop-shadow-xs
                  flex items-center gap-1.5
                "
              >
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                Campus Confession
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Confess Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  lastFocusedRef.current = e.currentTarget
                  setComposerOpen(true)
                }}
                className="
                  flex items-center gap-2
                  rounded-full bg-white/20 backdrop-blur-md
                  px-3.5 py-1.5 text-xs font-bold text-white
                  border border-white/30 shadow-sm
                  transition-all duration-200
                  hover:bg-white/30 hover:scale-105 active:scale-95
                  cursor-pointer z-10
                "
              >
                <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Confess</span>
              </button>
            </div>
          </div>

          {/* ── Main Content Area ── */}
          <div className="relative z-10 px-5 sm:px-6 py-2 flex-1 flex flex-col justify-center" aria-live="polite">
            {isError && confessions.length === 0 ? (
              <div className="text-left space-y-1.5 py-2">
                <p className="text-lg sm:text-xl font-bold text-white drop-shadow-md">
                  Couldn&apos;t load confessions.
                </p>
                <p className="text-xs sm:text-sm text-white/80">
                  Check your connection — we&apos;ll keep retrying in the background.
                </p>
              </div>
            ) : currentConfession ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentConfession.id ?? activeIndex}
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="space-y-2"
                >
                  <p
                    className="
                      text-lg sm:text-2xl md:text-3xl
                      font-medium leading-snug sm:leading-relaxed
                      text-white break-words drop-shadow-md
                      line-clamp-3 sm:line-clamp-2
                    "
                  >
                    &ldquo;{currentConfession.content}&rdquo;
                  </p>

                  <div className="flex items-center gap-2">
                    {currentConfession.authorName && currentConfession.authorName !== 'anonymous' ? (
                      <Link
                        to="/profile/$username"
                        params={{ username: currentConfession.authorName }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs sm:text-sm font-semibold text-white/80 drop-shadow-xs hover:underline cursor-pointer"
                      >
                        @{currentConfession.authorName}
                      </Link>
                    ) : (
                      <p className="text-xs sm:text-sm font-semibold text-white/80 drop-shadow-xs">
                        @anonymous
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              /* Empty state */
              <div className="text-left space-y-1.5 py-2">
                <p className="text-lg sm:text-xl font-bold text-white drop-shadow-md">
                  No confessions yet today.
                </p>
                <p className="text-xs sm:text-sm text-white/80">
                  Be the first to share an anonymous campus secret!
                </p>
              </div>
            )}
          </div>

          {/* ── Card Footer ── */}
          <div className="relative z-10 px-4 sm:px-6 pt-0 pb-4 sm:pb-5 flex items-center justify-between">
            {currentConfession ? (
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                  {/* Upvote Pill */}
                  <button
                    type="button"
                    disabled={upvoteMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (currentConfession && !upvoteMutation.isPending) {
                        upvoteMutation.mutate(currentConfession.id)
                      }
                    }}
                    className={`
                      flex items-center gap-1.5 rounded-full px-3 py-1.5 sm:px-3.5 text-xs font-bold
                      transition-all duration-200 border z-10 active:scale-95 shadow-sm
                      disabled:opacity-60 disabled:cursor-not-allowed
                      ${upvoteMutation.isPending
                        ? 'cursor-wait'
                        : 'cursor-pointer'
                      }
                      ${currentConfession.isUpvoted
                        ? 'bg-rose-500/30 text-rose-200 border-rose-400/60 backdrop-blur-md shadow-rose-900/30'
                        : 'bg-white/15 text-white/90 border-white/25 backdrop-blur-md hover:bg-white/25 hover:text-white'
                      }
                    `}
                    aria-pressed={!!currentConfession.isUpvoted}
                    aria-label={currentConfession.isUpvoted ? 'Remove upvote' : 'Upvote confession'}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${currentConfession.isUpvoted
                        ? 'fill-rose-500 text-rose-500 scale-110'
                        : 'group-hover:scale-110'
                        }`}
                    />
                    <span>{currentConfession.upvoteCount || 0}</span>
                  </button>

                  {/* Dot Indicators for active confession carousel (sliding window of max 5 dots) */}
                  {confessions.length > 1 && (() => {
                    const MAX_VISIBLE_DOTS = 5
                    const total = confessions.length
                    let startDotIndex = 0
                    if (total > MAX_VISIBLE_DOTS) {
                      const half = Math.floor(MAX_VISIBLE_DOTS / 2)
                      startDotIndex = Math.max(0, Math.min(activeIndex - half, total - MAX_VISIBLE_DOTS))
                    }
                    const visibleDots = Array.from(
                      { length: Math.min(MAX_VISIBLE_DOTS, total) },
                      (_, i) => startDotIndex + i
                    )

                    return (
                      <div
                        className="hidden sm:flex items-center gap-1.5 bg-black/30 backdrop-blur-md rounded-full px-2 py-1.5 sm:px-2.5 border border-white/10"
                        role="tablist"
                        aria-label="Confession navigation"
                      >
                        {visibleDots.map((idx) => (
                          <button
                            key={idx}
                            type="button"
                            role="tab"
                            aria-selected={idx === activeIndex}
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveIndex(idx)
                              setImageIndex(safeMod(idx, imagePool.length))
                            }}
                            className={`
                              h-1.5 rounded-full transition-all duration-300 cursor-pointer
                              ${idx === activeIndex
                                ? 'w-4 sm:w-5 bg-white'
                                : 'w-1.5 bg-white/40 hover:bg-white/70'
                              }
                            `}
                            aria-label={`Go to confession ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Right side: Nav arrows & Tap to read prompt */}
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                  {confessions.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrev}
                        className="p-1.5 sm:p-1 rounded-full bg-white/15 hover:bg-white/30 text-white border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
                        aria-label="Previous confession"
                      >
                        <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="p-1.5 sm:p-1 rounded-full bg-white/15 hover:bg-white/30 text-white border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
                        aria-label="Next confession"
                      >
                        <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  )}

                  <span
                    className="
                      hidden sm:inline-flex items-center gap-1
                      text-xs sm:text-sm font-semibold
                      text-white/90 group-hover:text-white
                      transition-colors duration-200 drop-shadow-xs
                    "
                  >
                    <span>Tap to read</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  lastFocusedRef.current = e.currentTarget
                  setComposerOpen(true)
                }}
                className="
                  text-xs sm:text-sm font-semibold
                  text-white underline underline-offset-4
                  cursor-pointer hover:text-primary-foreground transition-colors
                "
              >
                Share a confession →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Composer Dialog ── */}
      <Dialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Submit Anonymous Confession"
      >
        <ConfessionComposer />
      </Dialog>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedConfession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="
              fixed inset-0 z-50
              flex items-center justify-center
              p-4 sm:p-6
              bg-black/70 backdrop-blur-md
            "
            onClick={closeConfession}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="
                relative w-full max-w-lg max-h-[85vh]
                flex flex-col rounded-3xl
                border border-border/60
                bg-surface-elevated shadow-2xl
                overflow-hidden
              "
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Confession details"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted truncate flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {selectedConfession.campus
                      ? `Confession · ${selectedConfession.campus}`
                      : 'Campus Confession'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-foreground-subtle">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Expires in 24h
                  </span>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeConfession}
                  className="
                    p-2 rounded-full
                    text-foreground-muted hover:bg-surface-muted hover:text-foreground
                    transition-colors duration-150 cursor-pointer
                  "
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto min-h-0 flex-1 space-y-5">
                <p className="text-lg sm:text-xl font-normal leading-relaxed text-foreground break-words whitespace-pre-wrap">
                  &ldquo;{selectedConfession.content}&rdquo;
                </p>

                <div className="pt-4 border-t border-border/40 flex items-center justify-between">
                  {selectedConfession.authorName?.includes('[ADMIN VIEW]') ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span>{selectedConfession.authorName}</span>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-foreground-muted">
                      @{selectedConfession.authorName || 'anonymous'}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={upvoteMutation.isPending}
                    onClick={() => {
                      if (!upvoteMutation.isPending) {
                        upvoteMutation.mutate(selectedConfession.id)
                      }
                    }}
                    className={`
                      flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold
                      transition-all duration-200 border active:scale-95 shadow-xs
                      disabled:opacity-60 disabled:cursor-not-allowed
                      ${upvoteMutation.isPending ? 'cursor-wait' : 'cursor-pointer'
                      }
                      ${selectedConfession.isUpvoted
                        ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                        : 'bg-surface-muted text-foreground-muted hover:text-foreground border-border'
                      }
                    `}
                    aria-pressed={!!selectedConfession.isUpvoted}
                  >
                    <Heart
                      className={`h-4 w-4 ${selectedConfession.isUpvoted
                        ? 'fill-rose-500 text-rose-500'
                        : ''
                        }`}
                    />
                    <span>{selectedConfession.upvoteCount || 0} Upvotes</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}