import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    launcher: 'src/launcher.ts',
  },
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: false,
})
