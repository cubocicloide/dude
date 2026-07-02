import { invoke } from '@tauri-apps/api/core'

/**
 * Typed wrappers for the counter commands (src-tauri/src/commands/counter.rs).
 *
 * The counter lives in the Rust managed state (`AppState`) — the single source
 * of truth. Every change is broadcast back to the frontend through the
 * COUNTER_CHANGED_EVENT event; subscribe with useTauriEvent.
 */

/** Event emitted by the backend every time the counter changes. Payload: the new value. */
export const COUNTER_CHANGED_EVENT = 'counter-changed'

/** Read the current counter value from the backend state. */
export async function getCounter(): Promise<number> {
  return invoke<number>('get_counter')
}

/** Increment the counter by `amount` (default 1) and return the new value. */
export async function incrementCounter(amount = 1): Promise<number> {
  return invoke<number>('increment_counter', { amount })
}
