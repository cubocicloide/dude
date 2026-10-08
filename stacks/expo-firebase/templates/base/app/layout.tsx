import { Slot } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/features/auth/AuthProvider'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
