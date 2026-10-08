# Architecture

`app/` owns navigation only. Product behavior lives in `src/features/`, shared
UI in `src/components/`, and shared hooks in `src/hooks/`.

Firebase has two boundaries:

1. `src/lib/firebase/` creates singleton SDK services and connects emulators.
2. `src/features/<feature>/repository.ts` exposes typed domain operations.

The notes collection is nested at `users/{uid}/notes/{noteId}` so both client
queries and Firestore rules share an explicit ownership boundary.
