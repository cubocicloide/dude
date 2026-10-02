import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/hooks/useAuth'

export default function IndexRoute() {
  const { user, loading } = useAuth()
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  return <Redirect href={user ? '/(app)' : '/sign-in'} />
}
