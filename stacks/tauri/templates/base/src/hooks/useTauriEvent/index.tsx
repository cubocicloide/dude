import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'

/**
 * Subscribe to a Tauri event for the lifetime of the component.
 *
 * `listen()` resolves *asynchronously* to an unlisten function — forgetting to
 * await and call it is the classic Tauri listener leak. This hook owns that
 * lifecycle: it subscribes on mount, unsubscribes on unmount, and always calls
 * the latest handler (so callers don't need useCallback).
 *
 * @example
 * useTauriEvent<number>('counter-changed', (value) => setCounter(value))
 */
export default function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let unmounted = false

    listen<T>(event, (e) => handlerRef.current(e.payload))
      .then((fn) => {
        // The component may unmount before the subscription resolves.
        if (unmounted) fn()
        else unlisten = fn
      })
      .catch(() => {
        // Running outside Tauri (plain `vite dev`) — events are unavailable.
      })

    return () => {
      unmounted = true
      unlisten?.()
    }
  }, [event])
}
