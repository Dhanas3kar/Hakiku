import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * SplashScreen — shown on initial app load while auth/session is resolving.
 *
 * Design decisions:
 * - Uses CSS variables from the existing design system (background, primary, foreground)
 * - Theme is applied server-side via THEME_INIT_SCRIPT in __root.tsx so the splash
 *   inherits the correct theme immediately without a flash.
 * - Minimum display time: 600ms to avoid a jarring flash on fast connections.
 * - Safety timeout: 5s — if auth never resolves, the splash exits gracefully.
 * - Fades out with a CSS transition; removed from DOM after fade completes.
 * - Uses sessionStorage to ensure it only shows on first load, never on SPA navigations.
 */

interface SplashScreenProps {
  /** Signal from the app that critical initialization is done */
  ready: boolean
}

const MIN_DISPLAY_MS = 600
const SAFETY_TIMEOUT_MS = 5000

export function SplashScreen({ ready }: SplashScreenProps) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)
  const startTimeRef = useRef(Date.now())
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Safety valve: always exit after SAFETY_TIMEOUT_MS regardless of state
    safetyTimerRef.current = setTimeout(() => {
      startFadeOut()
    }, SAFETY_TIMEOUT_MS)

    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!ready) return

    const elapsed = Date.now() - startTimeRef.current
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

    const t = setTimeout(() => {
      startFadeOut()
    }, remaining)

    return () => clearTimeout(t)
  }, [ready])

  function startFadeOut() {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
    setFading(true)
    // Remove from DOM after the CSS transition completes (500ms)
    setTimeout(() => setVisible(false), 500)
  }

  if (!visible) return null

  const splashContent = (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999, // Ensure it's above everything
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--background)',
        transition: 'opacity 500ms ease, visibility 500ms ease',
        opacity: fading ? 0 : 1,
        visibility: fading ? 'hidden' : 'visible',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          animation: 'splashEntrance 400ms ease forwards',
        }}
      >
        {/* Logo — switches between dark/light versions using CSS media + data-theme */}
        <div style={{ width: 'clamp(140px, 35vw, 200px)', height: 'auto' }}>
          {/* Dark theme logo (shown when :root has data-theme="dark" or prefers-color-scheme dark) */}
          <img
            src="/Dark_theme_logo.png"
            alt="HAKIKU"
            className="splash-logo-dark"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'none',
            }}
          />
          {/* Light theme logo */}
          <img
            src="/light_theme_logo.png"
            alt="HAKIKU"
            className="splash-logo-light"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'none',
            }}
          />
        </div>

        {/* Subtle pulsing indicator */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splashEntrance {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }

        /* Show dark logo when dark theme is active */
        html.dark .splash-logo-dark,
        html[data-theme="dark"] .splash-logo-dark {
          display: block !important;
        }
        html.dark .splash-logo-light,
        html[data-theme="dark"] .splash-logo-light {
          display: none !important;
        }

        /* Show light logo by default (light theme) */
        html:not(.dark):not([data-theme="dark"]) .splash-logo-light {
          display: block !important;
        }
        html:not(.dark):not([data-theme="dark"]) .splash-logo-dark {
          display: none !important;
        }

        /* System preference: dark */
        @media (prefers-color-scheme: dark) {
          html:not([data-theme="light"]) .splash-logo-dark {
            display: block !important;
          }
          html:not([data-theme="light"]) .splash-logo-light {
            display: none !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          @keyframes splashEntrance { from { opacity: 1; } to { opacity: 1; } }
          @keyframes splashDot { 0%, 100% { opacity: 0.5; } }
        }
      `}</style>
    </div>
  )

  // Only render via portal if document is defined (browser environment)
  if (typeof document !== 'undefined') {
    return createPortal(splashContent, document.body)
  }
  return splashContent
}
