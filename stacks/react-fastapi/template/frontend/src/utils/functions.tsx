/**
 * Returns a debounced version of `fn` that fires only after `delay` ms of
 * inactivity. Useful for search inputs and resize handlers.
 *
 * @example
 * const debouncedSearch = debounce(handleSearch, 300)
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Creates a new object containing only the specified keys.
 *
 * @example pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) → { a: 1, c: 3 }
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {} as Pick<T, K>)
}

/**
 * Creates a new object without the specified keys.
 *
 * @example omit({ a: 1, b: 2, c: 3 }, ['b']) → { a: 1, c: 3 }
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj }
  for (const key of keys) delete result[key]
  return result as Omit<T, K>
}

/**
 * Groups an array into a record keyed by the return value of `key`.
 *
 * @example groupBy(users, (u) => u.role) → { admin: [...], viewer: [...] }
 */
export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    ;(acc[k] ??= []).push(item)
    return acc
  }, {})
}

/**
 * Generates a cryptographically-safe random UUID v4.
 * Uses the Web Crypto API — available in all modern browsers and Node ≥ 19.
 */
export function uuid(): string {
  return crypto.randomUUID()
}

/**
 * Type-safe assertion that a value is non-null and non-undefined.
 * Throws at runtime if the invariant is violated.
 *
 * @example
 * const el = assertDefined(document.getElementById('root'), '#root not found')
 */
export function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message)
  return value
}
