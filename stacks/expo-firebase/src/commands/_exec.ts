import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'pathe'

export function localBin(projectRoot: string, name: string): string | null {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  const bin = path.join(projectRoot, 'node_modules', '.bin', `${name}${suffix}`)
  return existsSync(bin) ? bin : null
}

export function exec(cmd: string, args: string[], cwd: string): boolean {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) {
    process.stderr.write(`error: failed to run ${cmd}: ${result.error.message}\n`)
    return false
  }
  return result.status === 0
}

export function capture(cmd: string, args: string[]): string | null {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
  if (result.error || result.status !== 0) return null
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
}

export function requireLocalBin(projectRoot: string, name: string): string {
  const bin = localBin(projectRoot, name)
  if (bin) return bin
  process.stderr.write(`error: ${name} is not installed. Run \`pnpm install\` first.\n`)
  process.exit(1)
}

export function projectAnswer(projectRoot: string, key: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(path.join(projectRoot, 'dude.json'), 'utf8')) as {
      answers?: Record<string, unknown>
    }
    const value = manifest.answers?.[key]
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

export function section(title: string): void {
  process.stdout.write(`\n── ${title} ${'─'.repeat(Math.max(0, 48 - title.length))}\n`)
}
