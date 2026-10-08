import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppButton } from '@/components/AppButton'
import { AppInput } from '@/components/AppInput'
import { useAuth } from '@/hooks/useAuth'
import { createNote, deleteNote, subscribeToNotes, updateNote } from './repository'
import type { Note } from './types'

export function NotesScreen() {
  const { user, signOut } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeToNotes(user.uid, (nextNotes) => {
      setNotes(nextNotes)
      setBusy(false)
    })
  }, [user])

  async function save() {
    if (!user || !title.trim()) return
    setError(null)
    try {
      if (editingId) await updateNote(user.uid, editingId, { title, body })
      else await createNote(user.uid, { title, body })
      setTitle('')
      setBody('')
      setEditingId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the note')
    }
  }

  function edit(note: Note) {
    setEditingId(note.id)
    setTitle(note.title)
    setBody(note.body)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Your notes</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <AppButton onPress={() => void signOut()}>Sign out</AppButton>
        </View>
        <View style={styles.form}>
          <AppInput label="Title" value={title} onChangeText={setTitle} />
          <AppInput label="Body" value={body} onChangeText={setBody} multiline />
          <AppButton disabled={!title.trim()} onPress={() => void save()}>
            {editingId ? 'Update note' : 'Add note'}
          </AppButton>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(note) => note.id}
            ListEmptyComponent={<Text style={styles.empty}>No notes yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.note}>
                <Text style={styles.noteTitle}>{item.title}</Text>
                <Text style={styles.noteBody}>{item.body}</Text>
                <View style={styles.actions}>
                  <AppButton onPress={() => edit(item)}>Edit</AppButton>
                  <AppButton
                    tone="danger"
                    onPress={() => user && void deleteNote(user.uid, item.id)}
                  >
                    Delete
                  </AppButton>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f8fafc', flex: 1 },
  container: { alignSelf: 'center', flex: 1, gap: 18, maxWidth: 760, padding: 20, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '700' },
  email: { color: '#64748b' },
  form: { backgroundColor: '#fff', borderRadius: 14, gap: 12, padding: 16 },
  note: { backgroundColor: '#fff', borderRadius: 14, gap: 8, marginBottom: 12, padding: 16 },
  noteTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  noteBody: { color: '#334155' },
  actions: { flexDirection: 'row', gap: 10 },
  empty: { color: '#64748b', padding: 24, textAlign: 'center' },
  error: { color: '#b91c1c' },
})
