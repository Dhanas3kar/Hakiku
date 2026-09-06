import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { confessionsApi, type HeroConfession } from '../../api/confessions'
import { useAuth } from '../../hooks/useAuth'
import { MessageSquarePlus, ArrowRight, Clock, X } from 'lucide-react'
import { ConfessionComposer } from '../community/ConfessionComposer'
import { Dialog } from '../ui/Dialog'
import { motion, AnimatePresence } from 'framer-motion'

export interface ConfessionHeroProps {
  mode?: 'static' | 'carousel'
  customImages?: string[]
}

/* ─── local SRM campus photographs ─── */
const FALLBACK_CAMPUS_IMAGES = [
  '/images/Golden hourss SRM.jpg',
  '/images/SRM UNIVERSITY.jpg',
  '/images/srm ktr.jpg',
  '/images/download (1).jpg',
  '/images/Log in to Foursquare.jpg',
  '/images/SRM UNIVERSITY AP.jpg',
  '/images/uni!!!.jpg',
  '/images/SRM Institute of Science and Technology Admission.jpg',
  '/images/SRMIST-BANNER-5.jpg',
  '/images/SaveClip_App_748231415_18134455357578669_6154616745790124350_n.jpg',
  '/images/SaveClip_App_748232007_18134455354578669_7507357941153173886_n.jpg',
  '/images/SaveClip_App_748242935_18134455336578669_2181690689649073789_n.jpg',
  '/images/SaveClip_App_748787214_18134455324578669_8936722940320199570_n.jpg',
  '/images/download (1).webp',
  '/images/images (13).jpeg',
  '/images/images (14).jpeg',
]

/* ─── motion settings ─── */
const fadeVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export function ConfessionHero({
  mode = 'carousel',
  customImages,
}: ConfessionHeroProps) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedConfession, setSelectedConfession] =
    useState<HeroConfession | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const { isAuthenticated } = useAuth()

  const { data: result, isLoading } = useQuery({
    queryKey: ['confessions', 'hero'],
    queryFn: () => confessionsApi.getHeroConfession(),
    enabled: isAuthenticated,
    staleTime: 5 * 1000,
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : 10 * 1000,
  })

  const rawConfessions = result?.items || []
  const confessions = rawConfessions.filter((item) => {
    const pubDate = item.publishedAt || item.createdAt
    if (!pubDate) return true
    const timestamp = new Date(pubDate).getTime()
    if (isNaN(timestamp)) return true
    return Date.now() - timestamp < 24 * 60 * 60 * 1000
  })

  /* image pool definition */
  const imagePool =
    customImages && customImages.length > 0
      ? customImages
      : FALLBACK_CAMPUS_IMAGES

  /* safety bounds */
  useEffect(() => {
    if (confessions.length > 0 && activeIndex >= confessions.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, confessions.length])

  /* pre-cache images in browser memory for zero-flicker transitions */
  useEffect(() => {
    imagePool.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [imagePool])

  /* silent 5-second image & confession rotation */
  useEffect(() => {
    if (isHovered) return

    const timer = window.setInterval(() => {
      setImageIndex((prev) => (prev + 1) % imagePool.length)
      if (confessions.length > 1) {
        setActiveIndex((prev) => (prev + 1) % confessions.length)
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [isHovered, imagePool.length, confessions.length])

  /* ─── loading skeleton ─── */
  if (isLoading) {
    return (
      <div
        className="
          relative mb-5 w-full overflow-hidden rounded-2xl
          border border-border/40 bg-surface-elevated
          aspect-[16/7] sm:aspect-[3/1] min-h-[210px] sm:min-h-[230px]
          p-5 sm:p-6 flex flex-col justify-between animate-pulse
        "
      >
        <div className="flex items-center justify-between">
          <div className="h-3 w-36 rounded bg-surface-muted" />
          <div className="h-7 w-20 rounded-lg bg-surface-muted" />
        </div>
        <div className="space-y-2 py-2">
          <div className="h-6 w-5/6 rounded bg-surface-muted" />
          <div className="h-6 w-2/3 rounded bg-surface-muted" />
          <div className="h-3.5 w-24 rounded bg-surface-muted mt-2" />
        </div>
        <div className="h-3.5 w-28 rounded bg-surface-muted" />
      </div>
    )
  }

  const currentConfession = confessions[activeIndex] || null

  const bgImage =
    currentConfession?.imageUrl ||
    imagePool[imageIndex % imagePool.length]

  return (
    <>
      {/* ─── Editorial Confession Card ─── */}
      <div
        className="
          group relative mb-5 w-full
          overflow-hidden rounded-2xl
          border border-border/40
          bg-surface-elevated shadow-md
          transition-all duration-300
          hover:shadow-lg
          aspect-[16/8] sm:aspect-[3/1]
          min-h-[220px] sm:min-h-[240px]
          flex flex-col justify-between
          select-none cursor-pointer
        "
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => currentConfession && setSelectedConfession(currentConfession)}
      >
        {/* photographic background with smooth transition */}
        <AnimatePresence mode="popLayout">
          <motion.img
            key={bgImage}
            src={bgImage}
            alt="Campus environment"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.3 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="
              absolute inset-0 h-full w-full
              object-cover object-center
              pointer-events-none
              transition-transform duration-700 ease-out
              group-hover:scale-[1.015]
            "
            aria-hidden="true"
          />
        </AnimatePresence>

        {/* contrast overlay */}
        <div
          className="
            absolute inset-0
            bg-gradient-to-t from-black/85 via-black/55 to-black/35
            pointer-events-none
          "
          aria-hidden="true"
        />

        {/* ── card header ── */}
        <div className="relative z-10 flex items-center justify-between p-5 sm:p-6 pb-0">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full bg-primary shrink-0"
              aria-hidden="true"
            />
            <span
              className="
                text-[11px] sm:text-xs font-semibold
                uppercase tracking-widest
                text-white/90
              "
            >
              Campus Confession
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setComposerOpen(true)
            }}
            className="
              flex items-center gap-1.5
              rounded-lg bg-white/15 backdrop-blur-md
              px-3 py-1.5 text-xs font-semibold text-white
              border border-white/20
              transition-all duration-200
              hover:bg-white/25 active:scale-95
              cursor-pointer z-10
            "
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Confess</span>
          </button>
        </div>

        {/* ── main content ── */}
        <div className="relative z-10 px-5 sm:p-6 py-2 flex-1 flex flex-col justify-center">
          {currentConfession ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentConfession.id ?? activeIndex}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-1.5"
              >
                <p
                  className="
                    text-lg sm:text-xl md:text-2xl
                    font-normal leading-snug sm:leading-relaxed
                    text-white break-words
                    line-clamp-3 sm:line-clamp-2
                  "
                >
                  &ldquo;{currentConfession.content}&rdquo;
                </p>

                <p className="text-xs sm:text-sm font-medium text-white/70">
                  @{currentConfession.authorName || 'anonymous'}
                </p>
              </motion.div>
            </AnimatePresence>
          ) : (
            /* empty state */
            <div className="text-left space-y-1 py-2">
              <p className="text-base sm:text-lg font-medium text-white">
                No confessions yet.
              </p>
              <p className="text-xs sm:text-sm text-white/70">
                Be the first to share something anonymously.
              </p>
            </div>
          )}
        </div>

        {/* ── card footer ── */}
        <div className="relative z-10 px-5 sm:p-6 pt-0 pb-4 sm:pb-5 flex items-center justify-between">
          {currentConfession ? (
            <span
              className="
                inline-flex items-center gap-1.5
                text-xs sm:text-sm font-medium
                text-white/80 group-hover:text-white
                transition-colors duration-200
              "
            >
              <span>Tap to read</span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setComposerOpen(true)
              }}
              className="
                text-xs sm:text-sm font-semibold
                text-primary-foreground underline underline-offset-4
                cursor-pointer
              "
            >
              Share a confession →
            </button>
          )}
        </div>
      </div>

      {/* ── composer dialog ── */}
      <Dialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Submit Anonymous Confession"
      >
        <ConfessionComposer />
      </Dialog>

      {/* ── modal ── */}
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
              bg-black/60 backdrop-blur-sm
            "
            onClick={() => setSelectedConfession(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="
                relative w-full max-w-lg max-h-[85vh]
                flex flex-col rounded-2xl
                border border-border
                bg-surface-elevated shadow-xl
                overflow-hidden
              "
              onClick={(e) => e.stopPropagation()}
            >
              {/* modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted truncate">
                    {selectedConfession.campus
                      ? `Confession · ${selectedConfession.campus}`
                      : 'Anonymous Confession'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-foreground-subtle">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    Expires in 24h
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedConfession(null)}
                  className="
                    p-1.5 rounded-lg
                    text-foreground-muted hover:bg-surface-muted
                    transition-colors duration-150 cursor-pointer
                  "
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* modal content */}
              <div className="p-5 sm:p-6 overflow-y-auto min-h-0 flex-1 space-y-3">
                <p className="text-base sm:text-lg italic leading-relaxed text-foreground break-words whitespace-pre-wrap">
                  &ldquo;{selectedConfession.content}&rdquo;
                </p>
                <p className="text-xs font-medium text-foreground-muted">
                  @{selectedConfession.authorName || 'anonymous'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

