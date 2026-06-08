/**
 * Shared helpers for interactive integration tests.
 *
 * - step()              prints a visible step header during a test run
 * - logOutput()         indents and prints command output
 * - confirmAndCleanup() pauses at the end of a test suite and asks the user
 *                       whether to delete the scaffolded project
 */
import { createInterface } from 'node:readline'
import { rmSync } from 'node:fs'

const RULE = '─'.repeat(60)

/** Print a clearly visible step header to the terminal. */
export function step(label: string): void {
  process.stdout.write(`\n▶  ${label}\n`)
}

/** Indent and print command stdout/stderr so it is easy to read inline. */
export function logOutput(output: string): void {
  const lines = output.trim().split('\n').filter(Boolean)
  for (const line of lines) process.stdout.write(`     ${line}\n`)
}

/**
 * Pause at the end of a test suite, show where the test project lives, and
 * ask the user to confirm before deleting it.
 *
 * Designed to be called from a final `it('cleanup', ...)` with a long timeout
 * so the user has time to inspect files before answering.
 *
 * If stdin is not a TTY (CI, piped input) the prompt is skipped and the
 * project is kept with instructions for manual removal.
 */
export async function confirmAndCleanup(projectDir: string): Promise<void> {
  process.stdout.write(`\n${RULE}\n`)
  process.stdout.write('📁 Test project is at:\n')
  process.stdout.write(`   ${projectDir}\n`)
  process.stdout.write('\n   Open that directory and inspect the files.\n')
  process.stdout.write(`   When you are done, answer the question below.\n`)
  process.stdout.write(`${RULE}\n`)

  if (!process.stdin.isTTY) {
    process.stdout.write('\n⚠  stdin is not a TTY — skipping interactive prompt.\n')
    process.stdout.write(`   To clean up manually run:\n`)
    process.stdout.write(`   Remove-Item -Recurse -Force "${projectDir}"\n\n`)
    return
  }

  const answer = await new Promise<string>(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question('\n▶  Type "yes" and press Enter to delete the test project: ', ans => {
      rl.close()
      resolve(ans)
    })
  })

  if (answer.trim().toLowerCase() === 'yes') {
    rmSync(projectDir, { recursive: true, force: true })
    process.stdout.write('✓  Cleaned up.\n\n')
  } else {
    process.stdout.write(`ℹ  Kept — find it at:\n   ${projectDir}\n\n`)
  }
}
