# @cubocicloide/stack-tauri

## 0.2.0

### Minor Changes

- 2ccc3a6: Add the `tauri` stack: scaffolds a Tauri 2 desktop app (React 19 + Vite +
  Ant Design frontend, Rust backend) with an optional SQLite database
  (`--database sqlite`). Ships `dev`, `build`, `doctor`, `icon`, `lint`,
  `format`, `review`, `test` and `docs` commands, plus 22 structural lint
  checks (FE001–FE011 for the React side, BE001–BE011 for Rust/Tauri best
  practices) each documented in the generated project's `.claude/rules/`.
  The CLI registry now resolves the `tauri` stack name.

### Patch Changes

- Updated dependencies [2ccc3a6]
  - @cubocicloide/dude@0.11.3
