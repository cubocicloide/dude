import { Page } from 'playwright'

/**
 * Scaffold page object — rename to reflect the actual UI screen.
 *
 * Naming convention (ET004): file must follow the `*Page.ts` pattern.
 * Use ARIA roles and labels in selectors to stay resilient to CSS changes.
 */
export class ExamplePage {
  constructor(private readonly page: Page) {}

  async navigate(baseUrl: string): Promise<void> {
    await this.page.goto(baseUrl)
    await this.page.waitForLoadState('networkidle')
  }
}
