# Firebase setup

The Firebase JavaScript SDK configuration is public project identification, not
an authorization secret. Firestore Security Rules protect data.

For a live environment:

1. Create a Firebase project and web app.
2. Enable Email/Password under Authentication.
3. Create a Firestore database.
4. Copy `.env.example` to `.env`, set emulator mode to false, and fill every
   `EXPO_PUBLIC_FIREBASE_*` value from the web-app config.
5. Run `dude firebase deploy --project <firebase-project-id>`.

The deploy command runs the security-rules tests first and deploys only
Firestore rules and indexes. It rejects `demo-*` project IDs.
