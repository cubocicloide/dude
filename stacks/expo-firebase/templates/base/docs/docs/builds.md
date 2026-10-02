# EAS builds

Before the first mobile build, authenticate and link the project:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init
```

Then build an explicit target:

```bash
dude build --platform android --profile preview
dude build --platform ios --profile production
```

Development, preview, and production profiles live in `eas.json`. Web does not
use EAS Build: `dude build --platform web` exports a static bundle to `dist/`.
EAS Update and store submission are intentionally manual in this version.
