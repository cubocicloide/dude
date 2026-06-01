#!/usr/bin/env node
import('../dist/cli.js')
  .then((mod) => mod.run())
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
