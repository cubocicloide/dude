import { addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore'
import { createNote, updateNote } from '@/features/notes/repository'
import { firestore } from '@/lib/firebase'

jest.mock('@/lib/firebase', () => ({ firestore: { name: 'test-firestore' } }))
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => ({ name: 'notes-collection' })),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => ({ name: 'note-document' })),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
  updateDoc: jest.fn(),
}))

describe('notes repository', () => {
  it('creates notes only below the current user', async () => {
    await createNote('alice', { title: '  Hello  ', body: '  Private  ' })
    expect(collection).toHaveBeenCalledWith(firestore, 'users', 'alice', 'notes')
    expect(addDoc).toHaveBeenCalledWith(
      { name: 'notes-collection' },
      {
        title: 'Hello',
        body: 'Private',
        createdAt: 'server-time',
        updatedAt: 'server-time',
      },
    )
    expect(serverTimestamp).toHaveBeenCalledTimes(2)
  })

  it('preserves creation time when updating a note', async () => {
    await updateNote('alice', 'note-1', { title: 'Changed', body: 'Body' })
    expect(updateDoc).toHaveBeenCalledWith(
      { name: 'note-document' },
      { title: 'Changed', body: 'Body', updatedAt: 'server-time' },
    )
  })
})
