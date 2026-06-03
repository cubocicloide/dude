import { Given, Then } from '@cucumber/cucumber'
import { CustomWorld } from '../support/world'

// ── Background ─────────────────────────────────────────────────────────────

Given('the application is running', async function (this: CustomWorld) {
  try {
    await this.page.goto(this.baseUrl, { timeout: 10_000 })
    await this.page.waitForLoadState('networkidle')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isNetError =
      msg.includes('ERR_CONNECTION_REFUSED') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('NS_ERROR_CONNECTION_REFUSED')
    if (isNetError) {
      throw new Error(
        `Application is not reachable at ${this.baseUrl}.\n` +
          'Start the stack first:  dude up\n' +
          'Override the URL with:  BASE_URL=<url> pnpm test',
      )
    }
    throw err
  }
})

// ── Common assertions ──────────────────────────────────────────────────────

Then('the page title should not be empty', async function (this: CustomWorld) {
  const title = await this.page.title()
  if (!title) throw new Error('Page title is empty')
})
