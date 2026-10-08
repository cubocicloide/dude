import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

interface AppButtonProps {
  children: ReactNode
  onPress: () => void
  disabled?: boolean
  tone?: 'primary' | 'danger'
}

export function AppButton({ children, onPress, disabled, tone = 'primary' }: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tone === 'danger' && styles.danger, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  danger: { backgroundColor: '#b91c1c' },
  disabled: { opacity: 0.5 },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
