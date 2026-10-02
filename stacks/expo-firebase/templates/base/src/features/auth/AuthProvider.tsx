import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { connectFirebaseEmulators } from '@/lib/firebase'
import { signIn, signOut, signUp, subscribeToAuth } from './service'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: typeof signIn
  signUp: typeof signUp
  signOut: typeof signOut
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    connectFirebaseEmulators()
    return subscribeToAuth((nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const value = useMemo(() => ({ user, loading, signIn, signUp, signOut }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
