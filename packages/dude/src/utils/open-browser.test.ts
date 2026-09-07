import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * These tests exist to keep the *shell-free* property, not the platform switch:
 * the regression they guard against (CodeQL alert #4) was opening a URL through
 * `cmd /c start`, where `&` in the URL starts a second command.
 */
const spawnSync = vi.fn(() => ({ error: null as Error | null, status: 0 as number | null }))
vi.mock('node:child_process', () => ({ spawnSync }))

const realPlatform = process.platform
function asPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

beforeEach(() => {
  spawnSync.mockClear()
  spawnSync.mockReturnValue({ error: null, status: 0 })
})
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true })
  vi.restoreAllMocks()
})

describe('openBrowser', () => {
  it.each(['win32', 'darwin', 'linux'] as NodeJS.Platform[])(
    'never routes the URL through a shell on %s',
    async (platform) => {
      const { openBrowser } = await import('./open-browser.js')
      asPlatform(platform)

      expect(openBrowser('http://localhost:8001/?a=1&b=2')).toBe(true)

      const [cmd, args] = spawnSync.mock.calls[0] as unknown as [string, string[]]
      expect(cmd).not.toMatch(/^(cmd|sh|bash|zsh|powershell)$/)
      expect(args).not.toContain('/c')
      // The URL stays exactly one argv entry, so `&` cannot be a command separator.
      expect(args.filter((a) => a.includes('localhost:8001'))).toEqual([
        'http://localhost:8001/?a=1&b=2',
      ])
    },
  )

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'not a url', ''])(
    'refuses %s without spawning anything',
    async (url) => {
      const { openBrowser } = await import('./open-browser.js')
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      expect(openBrowser(url)).toBe(false)
      expect(spawnSync).not.toHaveBeenCalled()
      expect(String(stderr.mock.calls[0]?.[0])).toContain('Refusing to open')
    },
  )

  it('reports failure when the opener cannot be run', async () => {
    const { openBrowser } = await import('./open-browser.js')
    spawnSync.mockReturnValue({ error: new Error('ENOENT'), status: null })

    expect(openBrowser('https://example.com')).toBe(false)
  })
})
