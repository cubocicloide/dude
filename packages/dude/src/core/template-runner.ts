import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'pathe'
import Handlebars from 'handlebars'

export interface RenderOptions {
  /** Source directory (e.g. `<stack>/template`). */
  src: string
  /** Destination directory. */
  dest: string
  /** Variables exposed to Handlebars. */
  data: Record<string, unknown>
  /**
   * File suffix that triggers template rendering. Files ending with this
   * suffix are rendered and written without it; every other file is
   * copied verbatim.
   */
  templateSuffix?: string
}

/**
 * Copy a directory tree to `dest`. Files ending in `.hbs` are rendered as
 * Handlebars templates against `data` and written without the suffix.
 */
export async function renderTemplateTree(opts: RenderOptions): Promise<void> {
  const suffix = opts.templateSuffix ?? '.hbs'
  if (!existsSync(opts.src)) {
    throw new Error(`Template source not found: ${opts.src}`)
  }
  await fs.mkdir(opts.dest, { recursive: true })
  await walk(opts.src, opts.dest, opts.data, suffix)
}

async function walk(
  src: string,
  dest: string,
  data: Record<string, unknown>,
  suffix: string,
): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    let targetName = entry.name.endsWith(suffix) ? entry.name.slice(0, -suffix.length) : entry.name
    // Files prefixed with a single `_` followed by a non-`_` char are
    // renamed to `.` so that dotfiles can be shipped inside the template/
    // directory without confusing npm or git. Python `__init__.py` is left
    // alone because it starts with `__`.
    if (/^_[^_]/.test(targetName)) {
      targetName = `.${targetName.slice(1)}`
    }
    const destPath = path.join(dest, targetName)

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true })
      await walk(srcPath, destPath, data, suffix)
      continue
    }

    if (entry.name.endsWith(suffix)) {
      const raw = await fs.readFile(srcPath, 'utf8')
      const rendered = Handlebars.compile(raw, { noEscape: true })(data)
      await fs.writeFile(destPath, rendered, 'utf8')
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}
