---
'@cubocicloide/stack-react-fastapi': patch
'@cubocicloide/stack-react-django': patch
'@cubocicloide/stack-fastmcp': patch
'@cubocicloide/stack-airflow': patch
'@cubocicloide/stack-frappe': patch
'@cubocicloide/stack-tauri': patch
---

Fix `dude init` failing with `Cannot find package '@cubocicloide/dude'` when a stack is resolved via the cache-install path (fresh machine, no existing workspace/project). `@cubocicloide/dude` is imported unbundled at runtime (`external` in tsup) but had only been declared in `devDependencies` since #78 removed the redundant `peerDependencies` entry — devDependencies are never installed for a package consumed as someone else's dependency, so nothing pulled `@cubocicloide/dude` into `~/.dude/cache/stacks/…/node_modules`. Moved it to a real `dependencies` entry (still `workspace:*`, rewritten to an exact version at publish) instead of `peerDependencies`, so it installs correctly without reintroducing the changesets peer-range major-bump bug.
