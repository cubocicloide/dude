import { useState } from 'react'
import { Link } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppButton } from '@/components/AppButton'
import { AppInput } from '@/components/AppInput'
import { useAuth } from '@/hooks/useAuth'

interface AuthScreenProps {
  mode: 'sign-in' | 'sign-up'
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signingUp = mode === 'sign-up'

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await (signingUp ? signUp(email, password) : signIn(email, password))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>{signingUp ? 'Create an account' : 'Welcome back'}</Text>
        <Text style={styles.subtitle}>Firebase email and password authentication</Text>
        <AppInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <AppInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {busy ? (
          <ActivityIndicator />
        ) : (
          <AppButton disabled={!email || password.length < 6} onPress={submit}>
            {signingUp ? 'Sign up' : 'Sign in'}
          </AppButton>
        )}
        <Link href={signingUp ? '/sign-in' : '/sign-up'} style={styles.link}>
          {signingUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </Link>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center' },
  card: { alignSelf: 'center', gap: 16, maxWidth: 480, padding: 24, width: '100%' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '700' },
  subtitle: { color: '#475569', fontSize: 16 },
  error: { color: '#b91c1c' },
  link: { color: '#2563eb', textAlign: 'center' },
})
