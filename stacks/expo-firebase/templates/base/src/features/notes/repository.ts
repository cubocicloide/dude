import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Note, NoteInput } from './types'

function notesCollection(userId: string) {
  return collection(firestore, 'users', userId, 'notes')
}

function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Note {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    title: String(data.title),
    body: String(data.body),
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

export function subscribeToNotes(userId: string, listener: (notes: Note[]) => void): () => void {
  return onSnapshot(query(notesCollection(userId), orderBy('updatedAt', 'desc')), (snapshot) => {
    listener(snapshot.docs.map(fromSnapshot))
  })
}

export async function createNote(userId: string, input: NoteInput): Promise<void> {
  await addDoc(notesCollection(userId), {
    title: input.title.trim(),
    body: input.body.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateNote(userId: string, noteId: string, input: NoteInput): Promise<void> {
  await updateDoc(doc(firestore, 'users', userId, 'notes', noteId), {
    title: input.title.trim(),
    body: input.body.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'users', userId, 'notes', noteId))
}
