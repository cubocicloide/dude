import { IWorldOptions, World, setWorldConstructor } from '@cucumber/cucumber'
import { Browser, BrowserContext, Page } from 'playwright'

export interface ICustomWorld extends World {
  browser: Browser
  context: BrowserContext
  page: Page
  baseUrl: string
}

export class CustomWorld extends World implements ICustomWorld {
  browser!: Browser
  context!: BrowserContext
  page!: Page
  readonly baseUrl: string

  constructor(options: IWorldOptions) {
    super(options)
    // Override with BASE_URL env var in CI or against non-local environments.
    this.baseUrl = process.env.BASE_URL ?? 'http://localhost'
  }
}

setWorldConstructor(CustomWorld)
