import { DEFAULT_LOCALE } from '../constants'

/**
 * Formats an ISO date string or Date object as a short date.
 * @example formatDate('2026-01-15') → "Jan 15, 2026"
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats an ISO date string or Date object as a short datetime.
 * @example formatDateTime('2026-01-15T14:30:00Z') → "Jan 15, 2026, 14:30"
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats a number with thousands separators.
 * @example formatNumber(1000000) → "1,000,000"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString(DEFAULT_LOCALE)
}

/**
 * Formats a byte count as a human-readable size string.
 * @example formatBytes(1536) → "1.5 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}
