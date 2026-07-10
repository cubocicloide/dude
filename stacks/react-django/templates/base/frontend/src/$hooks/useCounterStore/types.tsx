/** State + actions of the example zustand counter store. */
export interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}
