import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Sequential file execution so interactive stdin prompts never overlap
    fileParallelism: false,
  },
})
