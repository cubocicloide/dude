import AsyncStorage from '@react-native-async-storage/async-storage'
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth'
import { Platform } from 'react-native'
import { firebaseApp } from './app'

declare global {
  var __expoFirebaseAuth: Auth | undefined
}

function initialize(): Auth {
  if (globalThis.__expoFirebaseAuth) return globalThis.__expoFirebaseAuth
  if (Platform.OS === 'web') return getAuth(firebaseApp)

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  } catch {
    return getAuth(firebaseApp)
  }
}

export const auth = initialize()
globalThis.__expoFirebaseAuth = auth
