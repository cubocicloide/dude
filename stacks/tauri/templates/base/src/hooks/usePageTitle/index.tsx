import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { APP_TITLE } from '@/utils/constants'

/**
 * Sets the native window title to `${pageTitle} — ${APP_TITLE}`.
 * Restores the bare app title on unmount.
 *
 * Requires the `core:window:allow-set-title` permission
 * (granted in src-tauri/capabilities/default.json).
 *
 * @example
 * // inside a page component:
 * usePageTitle('Notes')
 * // → window title = "Notes — my-app"
 */
export default function usePageTitle(pageTitle: string): void {
  useEffect(() => {
    const setTitle = (title: string) =>
      getCurrentWindow()
        .setTitle(title)
        .catch(() => {
          // Running outside Tauri (plain `vite dev`) — fall back to the tab title.
          document.title = title
        })

    void setTitle(pageTitle ? `${pageTitle} — ${APP_TITLE}` : APP_TITLE)
    return () => {
      void setTitle(APP_TITLE)
    }
  }, [pageTitle])
}
