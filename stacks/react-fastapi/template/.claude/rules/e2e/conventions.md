---
paths:
  - "e2e/**"
---

# E2E Test Conventions (ET001–ET007)

These rules are enforced by `dude lint` (codes ET001–ET007). Violations block CI.

---

## ET001 — Feature file naming

Feature files must be `snake_case.feature`.

| Valid | Invalid |
|-------|---------|
| `user_login.feature` | `UserLogin.feature` |
| `todo_creation.feature` | `todoCreation.feature` |

---

## ET002 — Feature → step definition pairing

Every `.feature` file must have a matching step definitions file:

```
e2e/features/user_login.feature  →  e2e/steps/user_login.steps.ts
```

Adding a new user flow = create **both** files in the same PR.

---

## ET003 — Step file → feature pairing (no orphans)

Every `*.steps.ts` file must have a matching `.feature` file, with one exception: `common.steps.ts` is exempt from this check (it holds shared steps).

An orphaned step file without a corresponding feature is an error.

---

## ET004 — Page object naming

Page object files must follow the `*Page.ts` naming convention (PascalCase prefix + `Page` suffix):

| Valid | Invalid |
|-------|---------|
| `LoginPage.ts` | `login-page.ts` |
| `TodoDetailPage.ts` | `todoDetail.ts` |

One class per file; the class name must match the filename.

---

## ET005 — Page object imports must resolve

Every page object imported in a step file must exist under `e2e/pages/`.

```typescript
// e2e/steps/user_login.steps.ts
import { LoginPage } from '../pages/LoginPage'; // → e2e/pages/LoginPage.ts must exist
```

If a page object is imported but the file is absent, that is an error.

---

## ET006 — Required config files

The following files must be present in `e2e/`:

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration |
| `cucumber.js` | Cucumber runner configuration |

---

## ET007 — No hardcoded URLs

Step files must not contain `http://` or `https://` literals. Always use `this.baseUrl` from `CustomWorld`:

```typescript
// Wrong
await this.page.goto("http://localhost:5173/todos");

// Correct
await this.page.goto(`${this.baseUrl}/todos`);
```

---

## Page object structure

```typescript
export class TodoDetailPage {
  constructor(private readonly page: Page) {}

  async navigate(baseUrl: string): Promise<void> {
    await this.page.goto(`${baseUrl}/todos/1`);
    await this.page.waitForLoadState("networkidle");
  }
}
```

- One class per file; filename matches class name (ET004)
- `navigate(baseUrl)` is the standard entry point — receive `baseUrl` from `CustomWorld`, never hardcode (ET007)
- Private helpers prefixed with `_`

## Step definition structure

```typescript
When("I do something with {string}", async function (this: CustomWorld, param: string) {
  const page = new TodoDetailPage(this.page);
  await page.someAction(param);
});
```

- `this: CustomWorld` — always type the context to access `this.page` and `this.baseUrl`
- Instantiate page objects inside the step, not at module level
- All steps must be `async`
- Use `expect` from `@playwright/test` for assertions

## Selector strategy (preference order)

1. ARIA roles + labels: `getByRole("button", { name: /submit/i })`, `getByLabel("Email")`
2. `data-testid` attributes for elements without semantic roles
3. CSS class fallback only when no semantic selector is available
