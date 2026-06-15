import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
    // Sequential: interactive confirmAndCleanup prompts must not overlap
    fileParallelism: false,
  },
})
