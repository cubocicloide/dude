import { useEffect } from 'react'

const APP_TITLE = import.meta.env.VITE_APP_TITLE as string

/**
 * Sets the browser tab title to `${pageTitle} — ${APP_TITLE}`.
 * Restores the bare app title on unmount.
 *
 * @example
 * // inside a page component:
 * usePageTitle('Dashboard')
 * // → document.title = "Dashboard — My App"
 */
export default function usePageTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${APP_TITLE}` : APP_TITLE
    return () => {
      document.title = APP_TITLE
    }
  }, [pageTitle])
}
