import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'pathe'

export function collectFiles(dir: string, filter: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectFiles(full, filter))
    else if (filter(entry.name)) out.push(full)
  }
  return out
}

export function readText(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

export function relative(root: string, file: string): string {
  return path.relative(root, file)
}
