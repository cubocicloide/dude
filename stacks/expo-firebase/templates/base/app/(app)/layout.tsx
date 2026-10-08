import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/hooks/useAuth'

export default function AppLayout() {
  const { user, loading } = useAuth()
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  if (!user) return <Redirect href="/sign-in" />
  return <Stack screenOptions={{ headerShown: false }} />
}
