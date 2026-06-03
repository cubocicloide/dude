# @cubocicloide/stack-react-fastapi

## Unreleased

### Minor Changes

- **tasks/ is now a required backend directory**: `backend/app/tasks/` and
  `backend/app/tests/tasks/` are part of the required structure enforced by
  lint checks BE001 and BE008.
- `template/backend/app/tasks/__init__.py` and
  `template/backend/app/tests/tasks/__init__.py` added to the base scaffold.
- Celery overlay now includes `tests/tasks/test_example.py`; CeleryBeat overlay
  includes `tests/tasks/test_scheduled.py`.
- `.claude/rules/BE/001.md` and `008.md` updated to reflect the new structure.

## 4.0.0

### Patch Changes

- Updated dependencies [c86b0d0]
  - @cubocicloide/dude@0.5.0

## 3.0.0

### Patch Changes

- Updated dependencies [3d0a4d1]
  - @cubocicloide/dude@0.4.0

## 2.0.0

### Minor Changes

- 7305179: feat: generated project includes pinned package.json + .npmrc — `dude init` now writes a root `package.json` with `@cubocicloide/dude` pinned to the exact version used at init time, and a `.npmrc` ready for GitHub Packages auth

### Patch Changes

- Updated dependencies [7305179]
  - @cubocicloide/dude@0.3.0

## 1.0.0

### Minor Changes

- b786a3d: feat: add `dude version` command, simplify init to single `dude.json`, add hooks/utils/assets to frontend template, add FE008 lint check, simplify Docker dev setup with HMR volumes

### Patch Changes

- Updated dependencies [b786a3d]
  - @cubocicloide/dude@0.2.0
