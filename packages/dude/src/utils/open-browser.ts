/**
 * Open a URL in the user's default browser — without ever handing it to a shell.
 *
 * Two commands carried a byte-identical copy of this (`dude docs`, `dude report`)
 * and both opened the Windows browser through `cmd /c start`, i.e. through
 * cmd.exe's parser. A URL assembled from a flag (`--port`, an issue title) that
 * contains `&`, `|` or `^` then stops being one argument and becomes a second
 * command. That is CodeQL's js/shell-command-constructed-from-input (alert #4).
 *
 * `rundll32 url.dll,FileProtocolHandler <url>` passes the URL to the Windows
 * protocol handler as a single argv entry with no shell in the chain, so the bug
 * class is removed rather than escaped. `open` (macOS) and `xdg-open` (Linux)
 * were already shell-free; they are here so there is one copy of the platform
 * switch, per the "identical everywhere → lives in one place" rule in CLAUDE.md.
 */
import { spawnSync } from 'node:child_process'

/** Schemes we are willing to hand to the OS handler. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * True when `url` is a well-formed http(s) URL.
 *
 * The OS handler acts on far more than the web: `file:` would open a local path
 * and a registered custom scheme can launch an application. Every caller here
 * builds an http(s) URL, so anything else is a bug — refuse it instead of
 * forwarding it.
 */
export function isSafeBrowserUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

/** Returns false when the URL was refused or the opener could not be run. */
export function openBrowser(url: string): boolean {
  if (!isSafeBrowserUrl(url)) {
    process.stderr.write(`[dude] Refusing to open a non-http(s) URL: ${url}\n`)
    return false
  }
  const result =
    process.platform === 'win32'
      ? spawnSync('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore' })
      : spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' })
  return result.error == null && result.status === 0
}
