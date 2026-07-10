import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CounterState } from './types'

/**
 * Example zustand store — global state shared across components without
 * prop-drilling or context. A store is a hook, so it lives in $hooks/.
 *
 * The devtools middleware connects to the Redux DevTools browser extension;
 * it is enabled only in dev builds. The third argument of `set` names the
 * action shown in the extension's timeline.
 *
 * @example
 * const { count, increment } = useCounterStore()
 */
const useCounterStore = create<CounterState>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }), undefined, 'counter/increment'),
      decrement: () => set((state) => ({ count: state.count - 1 }), undefined, 'counter/decrement'),
      reset: () => set({ count: 0 }, undefined, 'counter/reset'),
    }),
    { name: 'counter', enabled: import.meta.env.DEV },
  ),
)

export default useCounterStore
