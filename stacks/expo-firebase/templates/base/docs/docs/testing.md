# Testing

`dude test` runs both suites:

- Jest and React Native Testing Library for providers, components, and feature logic.
- Node's test runner plus the Firebase Rules Unit Testing library for Firestore security rules.
- Firebase Emulator Suite tests for Firestore authorization and validation.

Use `dude test --unit` or `dude test --emulator` to narrow the run. Rules tests
must cover the intended owner, unauthenticated requests, cross-user requests,
and malformed documents.
