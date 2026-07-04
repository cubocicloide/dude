import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'

/** Windows .cmd shims require shell execution to be found by spawnSync. */
function shouldUseShell(): boolean {
  return process.platform === 'win32'
}

/** True when `cmd --version` can be spawned (i.e. the tool is on PATH). */
export function isAvailable(cmd: string): boolean {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: shouldUseShell() })
  return r.error == null
}

/** Run a command inheriting stdio; returns true on exit code 0. */
export function exec(cmd: string, args: string[], cwd: string): boolean {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: shouldUseShell() })
  if (result.error) {
    process.stderr.write(`error: failed to run ${cmd}: ${result.error.message}\n`)
    return false
  }
  return result.status === 0
}

/** Capture a command's stdout (trimmed), or null on failure. */
export function capture(cmd: string, args: string[]): string | null {
  const r = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', shell: shouldUseShell() })
  if (r.error != null || r.status !== 0) return null
  return r.stdout.trim()
}

/**
 * Resolve a binary installed in the project's node_modules/.bin.
 * Returns null when dependencies have not been installed yet.
 */
export function localBin(projectRoot: string, name: string): string | null {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  const bin = path.join(projectRoot, 'node_modules', '.bin', `${name}${suffix}`)
  return existsSync(bin) ? bin : null
}

/**
 * Run the project-local Tauri CLI. Fails with a friendly message when the
 * project dependencies are missing (the CLI ships as a devDependency).
 */
export function runTauri(projectRoot: string, args: string[]): boolean {
  const bin = localBin(projectRoot, 'tauri')
  if (bin == null) {
    process.stderr.write(
      'error: the Tauri CLI is not installed in this project.\n' +
        'Install the project dependencies first:\n\n' +
        '  pnpm install\n\n',
    )
    process.exit(1)
  }
  return exec(bin, args, projectRoot)
}

/** Print a bold section header (plain when not a TTY). */
export function section(title: string): void {
  const isTTY = process.stdout.isTTY
  const line = '─'.repeat(Math.max(0, 52 - title.length))
  const header = `── ${title} ${line}`
  process.stdout.write(isTTY ? `\n\x1b[1m${header}\x1b[0m\n` : `\n${header}\n`)
}

/** Green/red final verdict helpers shared by test/review. */
export function verdict(ok: boolean, passMsg: string, failMsg: string): void {
  const isTTY = process.stdout.isTTY
  process.stdout.write('\n')
  if (ok) {
    process.stdout.write(isTTY ? `\x1b[32m${passMsg}\x1b[0m\n` : `${passMsg}\n`)
  } else {
    process.stderr.write(isTTY ? `\x1b[31m${failMsg}\x1b[0m\n` : `${failMsg}\n`)
    process.exit(1)
  }
}
