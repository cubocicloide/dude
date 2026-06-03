# @cubocicloide/dude

## 0.6.0

### Minor Changes

- cdff3ea: feat: export `renderTemplateTree` and `RenderOptions` for use in stack scaffold functions
- ba8469f: Add YAML frontmatter to .claude agents and skills; migrate rules from applyTo to paths key

## 0.5.0

### Minor Changes

- c86b0d0: feat: resolve stack version from npm registry at runtime — `registry.json` no longer pins a `stable` version; `dude init` queries npm for `latest`, installs that exact version, and pins it in `dude.json`/`package.json`

## 0.4.0

### Minor Changes

- 3d0a4d1: feat: auto-install stack on demand — when a stack package is not installed locally, dude installs it into `~/.dude/cache/stacks/` using npm and the user's `~/.npmrc` auth; cached by name+version so subsequent runs are instant

## 0.3.0

### Minor Changes

- 7305179: feat: generated project includes pinned package.json + .npmrc — `dude init` now writes a root `package.json` with `@cubocicloide/dude` pinned to the exact version used at init time, and a `.npmrc` ready for GitHub Packages auth

## 0.2.0

### Minor Changes

- b786a3d: feat: add `dude version` command, simplify init to single `dude.json`, add hooks/utils/assets to frontend template, add FE008 lint check, simplify Docker dev setup with HMR volumes
