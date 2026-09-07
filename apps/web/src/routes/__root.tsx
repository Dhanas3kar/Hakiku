import { HeadContent, Scripts, Outlet, createRootRoute } from '@tanstack/react-router'
import { Providers } from '../components/Providers'
import { NotFound } from '../components/NotFound'
import { GlobalErrorBoundary } from '../components/GlobalErrorBoundary'
import { Toaster } from 'sonner'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'HAKIKU',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-primary/20">
        <GlobalErrorBoundary>
          <Providers>
            <Outlet />
            <Toaster 
              position="top-center" 
              duration={3500}
              toastOptions={{
                duration: 3500,
                style: {
                  background: 'var(--surface-elevated, #16181c)',
                  color: 'var(--foreground, #f7f9f9)',
                  border: '1px solid var(--border, #2f3336)',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-sans)',
                },
                descriptionStyle: {
                  color: 'var(--foreground-muted, #71767b)',
                  fontSize: '0.8125rem',
                  marginTop: '2px',
                },
                actionButtonStyle: {
                  background: 'var(--primary, #1d9bf0)',
                  color: 'var(--primary-foreground, #ffffff)',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  padding: '6px 14px',
                },
                cancelButtonStyle: {
                  background: 'var(--surface-muted, #202327)',
                  color: 'var(--foreground-muted, #71767b)',
                  borderRadius: '9999px',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  padding: '6px 14px',
                },
              } as any}
            />
          </Providers>
        </GlobalErrorBoundary>
        <Scripts />
      </body>
    </html>
  )
}
