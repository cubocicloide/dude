import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Co-located tests live alongside their source in src/commands/*/index.test.ts
    include: ['src/**/*.test.ts'],
    // Run files sequentially — some tests scaffold real projects and must not
    // collide on shared tmpdir prefixes or stdin.
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
})
