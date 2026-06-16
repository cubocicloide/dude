/**
 * Minimal semver helpers — just enough for compatibility gating, without
 * pulling in the full `semver` dependency. Versions are treated as plain
 * `major.minor.patch`; any prerelease/build suffix is ignored.
 */

function parseCore(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version
    .trim()
    .replace(/^[v^~]/, '')
    .split('-')[0]!
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  return [major, minor, patch]
}

/** Return true when `current` >= `min` (plain x.y.z comparison). */
export function satisfiesMinVersion(current: string, min: string): boolean {
  const [c0, c1, c2] = parseCore(current)
  const [m0, m1, m2] = parseCore(min)
  if (c0 !== m0) return c0 > m0
  if (c1 !== m1) return c1 > m1
  return c2 >= m2
}
