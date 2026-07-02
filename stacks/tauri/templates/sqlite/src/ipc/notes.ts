import { invoke } from '@tauri-apps/api/core'

/**
 * Typed wrappers for the notes commands (src-tauri/src/commands/notes.rs).
 * Notes persist in SQLite under the platform app-data directory.
 */

/** Mirrors the Rust `Note` struct (serialized camelCase). */
export interface Note {
  id: number
  title: string
  body: string
  createdAt: string
}

/** List all notes, newest first. */
export async function listNotes(): Promise<Note[]> {
  return invoke<Note[]>('list_notes')
}

/** Create a note and return it (including the generated id and timestamp). */
export async function createNote(title: string, body?: string): Promise<Note> {
  return invoke<Note>('create_note', { title, body })
}

/** Delete a note by id. Rejects when the id does not exist. */
export async function deleteNote(id: number): Promise<void> {
  return invoke<void>('delete_note', { id })
}
