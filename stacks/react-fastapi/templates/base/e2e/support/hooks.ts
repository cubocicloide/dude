import path from 'path'
import { promises as fs } from 'fs'
import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  setDefaultTimeout,
} from '@cucumber/cucumber'
import { Browser, chromium } from 'playwright'
import { CustomWorld } from './world'

// Generous timeout to accommodate network-heavy scenarios.
setDefaultTimeout(90_000)

let sharedBrowser: Browser

BeforeAll(async () => {
  // Ensure report directories exist before any scenario runs.
  await fs.mkdir('reports/screenshots', { recursive: true })
  await fs.mkdir('reports/videos', { recursive: true })
  await fs.mkdir('reports/traces', { recursive: true })

  sharedBrowser = await chromium.launch({
    headless: !process.env.HEADED,
  })
})

AfterAll(async () => {
  await sharedBrowser?.close()
})

Before(async function (this: CustomWorld) {
  this.browser = sharedBrowser
  this.context = await this.browser.newContext({
    baseURL: this.baseUrl,
    recordVideo: { dir: 'reports/videos/' },
  })
  this.page = await this.context.newPage()
  await this.context.tracing.start({ screenshots: true, snapshots: true })
})

After(async function (this: CustomWorld, scenario) {
  const safeName = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_')
  const failed = scenario.result?.status === 'FAILED'

  const screenshot = await this.page?.screenshot({ fullPage: true }).catch(() => undefined)
  const videoPath = await this.page?.video()?.path().catch(() => undefined)

  if (failed) {
    if (screenshot) {
      await fs
        .writeFile(path.join('reports/screenshots', `${safeName}.png`), screenshot)
        .catch(() => undefined)
    }
    await this.context?.tracing
      .stop({ path: path.join('reports/traces', `${safeName}.zip`) })
      .catch(() => undefined)
  } else {
    await this.context?.tracing.stop().catch(() => undefined)
  }

  await this.page?.close()
  await this.context?.close()

  if (videoPath) {
    const destPath = path.join('reports/videos', `${safeName}.webm`)
    await fs.rename(videoPath, destPath).catch(async () => {
      await fs.copyFile(videoPath, destPath).catch(() => undefined)
    })
  }
})
