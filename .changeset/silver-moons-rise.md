---
"@cubocicloide/dude": minor
---

feat: resolve stack version from npm registry at runtime — `registry.json` no longer pins a `stable` version; `dude init` queries npm for `latest`, installs that exact version, and pins it in `dude.json`/`package.json`
