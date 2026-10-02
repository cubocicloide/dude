import type { Persistence } from 'firebase/auth'

interface ReactNativeStorage {
  getItem(key: string): Promise<string | null>
  removeItem(key: string): Promise<void>
  setItem(key: string, value: string): Promise<void>
}

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeStorage): Persistence
}
