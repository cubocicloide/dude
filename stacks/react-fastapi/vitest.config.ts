import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    // Some suites scaffold real projects and spawn the dude binary; run files
    // sequentially so they don't flood the machine with concurrent processes.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
})
