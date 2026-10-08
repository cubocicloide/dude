import type { ComponentProps } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

interface AppInputProps extends ComponentProps<typeof TextInput> {
  label: string
}

export function AppInput({ label, ...props }: AppInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor="#64748b"
        style={styles.input}
        {...props}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: '#334155', fontWeight: '600' },
  input: {
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    padding: 12,
  },
})
