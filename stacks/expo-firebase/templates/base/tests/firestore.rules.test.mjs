import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { after, afterEach, before, describe, it } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'

let environment

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-rules-test',
    firestore: { rules: readFileSync(resolve('firestore.rules'), 'utf8') },
  })
})

afterEach(async () => environment.clearFirestore())
after(async () => environment.cleanup())

const validNote = {
  title: 'First note',
  body: 'Private body',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}

describe('Firestore rules', () => {
  it('denies unauthenticated reads', async () => {
    const db = environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users/alice/notes/note-1')))
  })

  it('allows a user to create, read, update, and delete their own valid note', async () => {
    const db = environment.authenticatedContext('alice').firestore()
    const ref = doc(db, 'users/alice/notes/note-1')
    await assertSucceeds(setDoc(ref, validNote))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(updateDoc(ref, { title: 'Updated', updatedAt: Timestamp.now() }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('denies cross-user access', async () => {
    const db = environment.authenticatedContext('mallory').firestore()
    await assertFails(setDoc(doc(db, 'users/alice/notes/note-1'), validNote))
  })

  it('denies malformed notes', async () => {
    const db = environment.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(db, 'users/alice/notes/note-1'), { title: '' }))
  })
})
