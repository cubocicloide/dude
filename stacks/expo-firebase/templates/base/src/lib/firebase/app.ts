import { getApp, getApps, initializeApp } from 'firebase/app'
import { env } from '@/config/env'

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(env.firebase)
