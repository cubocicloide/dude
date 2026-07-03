/**
 * Cucumber.js CLI configuration.
 *
 * Conventions enforced by dude lint (ET002 / ET003):
 *   - features/ contains .feature files (Gherkin, snake_case names)
 *   - steps/    contains *.steps.ts step definitions (one per feature + common.steps.ts)
 *   - support/  contains world.ts and hooks.ts
 */
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['support/**/*.ts', 'steps/**/*.steps.ts'],
    requireModule: ['ts-node/register'],
    format: [
      'progress-bar',
      'html:reports/cucumber.html',
      'json:reports/cucumber.json',
    ],
    formatOptions: { snippetInterface: 'async-await' },
  },
}
