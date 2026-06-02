import { Given, Then } from '@cucumber/cucumber'
import { CustomWorld } from '../support/world'

// ── Background ─────────────────────────────────────────────────────────────

Given('the application is running', async function (this: CustomWorld) {
  await this.page.goto(this.baseUrl)
  await this.page.waitForLoadState('networkidle')
})

// ── Common assertions ──────────────────────────────────────────────────────

Then('the page title should not be empty', async function (this: CustomWorld) {
  const title = await this.page.title()
  if (!title) throw new Error('Page title is empty')
})
