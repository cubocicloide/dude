#!/usr/bin/env node
import('../dist/launcher.js')
  .then((mod) => process.exit(mod.run()))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
