import { readFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'pathe'
import type { StackVariable } from './stack-contract.js'

export interface RegistryEntry {
  package: string
  stable: string
  minimumSupported: string
}

export interface Registry {
  stacks: Record<string, RegistryEntry>
}

let cached: Registry | null = null

/**
 * Load the bundled `registry.json` shipped with the CLI. The path is
 * resolved relative to the dude package root so it works both in dev
 * (running from `dist/`) and after npm install.
 */
export async function loadRegistry(packageRoot: string): Promise<Registry> {
  if (cached) return cached
  const file = resolvePath(packageRoot, 'registry.json')
  const raw = await readFile(file, 'utf8')
  cached = JSON.parse(raw) as Registry
  return cached
}

export function resolveStackSpec(registry: Registry, stack: string): string {
  // Already an npm-like spec? leave it.
  if (stack.startsWith('@') || stack.startsWith('.') || stack.startsWith('/')) {
    return stack
  }
  const entry = registry.stacks[stack]
  if (!entry) {
    const known = Object.keys(registry.stacks).join(', ') || '(none)'
    throw new Error(`Unknown stack "${stack}". Known stacks: ${known}`)
  }
  return entry.package
}

export type { StackVariable }
