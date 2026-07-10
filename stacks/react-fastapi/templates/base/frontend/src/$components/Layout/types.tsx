import type { ReactNode } from 'react'

/** One sidebar navigation entry. */
export interface MenuEntry {
  key: string
  label: string
  icon: ReactNode
  path: string
}
