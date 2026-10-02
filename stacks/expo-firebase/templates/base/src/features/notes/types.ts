export interface Note {
  id: string
  title: string
  body: string
  createdAt: Date | null
  updatedAt: Date | null
}

export interface NoteInput {
  title: string
  body: string
}
