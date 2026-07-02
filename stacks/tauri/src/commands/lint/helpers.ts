import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import path from 'pathe'

/** Recursively collect files under `dir` matching `filter`, skipping `skipDirs` names. */
export function collectFiles(
  dir: string,
  filter: (name: string) => boolean,
  skipDirs: Set<string> = new Set(),
): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      out.push(...collectFiles(full, filter, skipDirs))
    } else if (filter(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/** 1-based line number of the character offset `index` inside `content`. */
export function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

/** Read a file as utf8, returning '' when it does not exist. */
export function readText(file: string): string {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function isDir(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory()
}

/**
 * Strip Rust test blocks (`#[cfg(test)] mod tests { … }`) from a source file so
 * checks don't flag unwrap()/println!() used legitimately inside unit tests.
 * Brace-counting from the `#[cfg(test)]` attribute to the matching close.
 */
export function stripRustTests(content: string): string {
  const marker = content.indexOf('#[cfg(test)]')
  if (marker === -1) return content

  const braceStart = content.indexOf('{', marker)
  if (braceStart === -1) return content.slice(0, marker)

  let depth = 0
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) {
        // Recurse in case of multiple #[cfg(test)] blocks in one file.
        return content.slice(0, marker) + stripRustTests(content.slice(i + 1))
      }
    }
  }
  return content.slice(0, marker)
}

/** Strip `//` line comments from Rust/TS source (keeps line count intact). */
export function stripLineComments(content: string): string {
  return content
    .split('\n')
    .map((l) => {
      const idx = l.indexOf('//')
      return idx === -1 ? l : l.slice(0, idx)
    })
    .join('\n')
}

/**
 * Extract the names of all `#[tauri::command]`-annotated functions in a Rust
 * source string, with the 1-based line of each attribute.
 */
export function findTauriCommands(content: string): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = []
  const re = /#\[tauri::command[^\]]*\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/g
  for (const m of content.matchAll(re)) {
    out.push({ name: m[1]!, line: lineOf(content, m.index ?? 0) })
  }
  return out
}
