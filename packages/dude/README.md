# @cubocicloide/dude

The CLI runtime. Stack-agnostic: capabilities (`init`, `lint`, `rules`,
`generate`, `review`) are delegated to stack plugins that implement the
`defineStack` contract.

See the [repository README](../../README.md) and
[ANALYSIS.md](../../ANALYSIS.md) for the full design.

## Local development

From the monorepo root:

```bash
make install
make build
make cli ARGS="--help"
```

## Public API

```ts
import { defineConfig, defineStack } from '@cubocicloide/dude'
```
