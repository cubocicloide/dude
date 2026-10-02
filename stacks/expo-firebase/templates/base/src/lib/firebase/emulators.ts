import { connectAuthEmulator } from 'firebase/auth'
import { connectFirestoreEmulator } from 'firebase/firestore'
import { env } from '@/config/env'
import { auth } from './auth'
import { firestore } from './firestore'

declare global {
  var __expoFirebaseEmulatorsConnected: boolean | undefined
}

export function connectFirebaseEmulators(): void {
  if (!env.useEmulators || globalThis.__expoFirebaseEmulatorsConnected) return
  connectAuthEmulator(auth, `http://${env.emulatorHost}:9099`, {
    disableWarnings: true,
  })
  connectFirestoreEmulator(firestore, env.emulatorHost, 8080)
  globalThis.__expoFirebaseEmulatorsConnected = true
}
