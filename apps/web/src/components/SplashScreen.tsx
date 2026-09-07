import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * SplashScreen
 *
 * Shown during initial application bootstrap while authentication/session
 * state is being resolved.
 *
 * Behaviour:
 * - Respects the existing application theme immediately.
 * - Minimum display time prevents a visual flash on fast loads.
 * - Safety timeout prevents the splash from getting stuck forever.
 * - Smooth CSS fade-out.
 * - Removed from the DOM after the fade completes.
 * - Only intended for initial application bootstrap.
 */

interface SplashScreenProps {
  /** True when critical application initialization is complete. */
  ready: boolean
}

const MIN_DISPLAY_MS = 600
const SAFETY_TIMEOUT_MS = 5000
const FADE_DURATION_MS = 500

export function SplashScreen({ ready }: SplashScreenProps) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  const startTimeRef = useRef(Date.now())
  const hasStartedFadeRef = useRef(false)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startFadeOut = useCallback(() => {
    // Prevent multiple fade-out calls from competing with each other.
    if (hasStartedFadeRef.current) return

    hasStartedFadeRef.current = true

    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }

    setFading(true)

    fadeTimerRef.current = setTimeout(() => {
      setVisible(false)
      fadeTimerRef.current = null
    }, FADE_DURATION_MS)
  }, [])

  /**
   * Safety timeout.
   *
   * Even if authentication/bootstrap gets stuck, the application should
   * eventually become usable instead of remaining behind the splash.
   */
  useEffect(() => {
    safetyTimerRef.current = setTimeout(() => {
      startFadeOut()
    }, SAFETY_TIMEOUT_MS)

    return () => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }

      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
    }
  }, [startFadeOut])

  /**
   * Hide once initialization is complete, while respecting the minimum
   * splash duration.
   */
  useEffect(() => {
    if (!ready || hasStartedFadeRef.current) return

    const elapsed = Date.now() - startTimeRef.current
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

    const timer = setTimeout(() => {
      startFadeOut()
    }, remaining)

    return () => clearTimeout(timer)
  }, [ready, startFadeOut])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="splash-screen"
    >
      <div className="splash-content">
        {/* Theme-aware logo */}
        <div className="splash-logo-container">
          <img
            src="/Dark_theme_logo.png"
            alt=""
            className="splash-logo splash-logo-dark"
          />

          <img
            src="/light_theme_logo.png"
            alt=""
            className="splash-logo splash-logo-light"
          />
        </div>

        {/* Loading indicator */}
        <div className="splash-loader" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="splash-dot"
              style={{
                animationDelay: `${index * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .splash-screen {
          position: fixed;
          inset: 0;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background);

          opacity: ${fading ? 0 : 1};
          visibility: ${fading ? 'hidden' : 'visible'};
          pointer-events: ${fading ? 'none' : 'all'};

          transition:
            opacity ${FADE_DURATION_MS}ms ease,
            visibility ${FADE_DURATION_MS}ms ease;
        }

        .splash-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;

          animation: splashEntrance 400ms ease forwards;
        }

        .splash-logo-container {
          width: clamp(140px, 35vw, 200px);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .splash-logo {
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        /*
         * Default: light logo.
         */
        .splash-logo-dark {
          display: none;
        }

        .splash-logo-light {
          display: block;
        }

        /*
         * Explicit dark theme.
         */
        html.dark .splash-logo-dark,
        html[data-theme="dark"] .splash-logo-dark {
          display: block;
        }

        html.dark .splash-logo-light,
        html[data-theme="dark"] .splash-logo-light {
          display: none;
        }

        /*
         * Explicit light theme always wins over system preference.
         */
        html[data-theme="light"] .splash-logo-dark {
          display: none;
        }

        html[data-theme="light"] .splash-logo-light {
          display: block;
        }

        /*
         * System theme.
         *
         * When there is no explicit light/dark selection, follow the OS.
         */
        @media (prefers-color-scheme: dark) {
          html:not([data-theme="light"]) .splash-logo-dark {
            display: block;
          }

          html:not([data-theme="light"]) .splash-logo-light {
            display: none;
          }
        }

        .splash-loader {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .splash-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: var(--primary);

          opacity: 0.5;

          animation:
            splashDot 1.2s ease-in-out infinite;
        }

        @keyframes splashEntrance {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes splashDot {
          0%,
          80%,
          100% {
            transform: scale(0.8);
            opacity: 0.4;
          }

          40% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-content {
            animation: none;
          }

          .splash-dot {
            animation: none;
            opacity: 0.5;
          }

          .splash-screen {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
