# `dude` — Analisi e Piano di Implementazione

> Documento di progettazione per il CLI tool `dude` di Cubocicloide.
> Ultima revisione: 2026-05-28
>
> **Revisione 2 (2026-05-28)**: rifattorizzata l'architettura. Gli stack non
> sono più hardcoded nel CLI: ogni stack è un **plugin autonomo** che porta
> con sé template + regole + lint + generators + hooks, versionati insieme.
> Il repo `dude` resta un **runtime/orchestratore** stack-agnostico.
>
> **Revisione 3 (2026-05-28)**: adottata strategia **monorepo ibrida**. CLI
>
> - stack ufficiali Cubocicloide vivono in un unico monorepo `cubocicloide/dude`
>   gestito con `pnpm workspaces` + `turbo` + `changesets`. Stack non ufficiali
>   (clienti, sperimentali, fork) restano in repo separati e si agganciano al CLI
>   tramite npm/git esattamente come quelli ufficiali. Aggiunta la sezione
>   **Workflow utente** che descrive l'esperienza del cliente che usa il CLI.

---

## 1. Visione del prodotto

`dude` è un CLI tool privato (distribuito tramite GitHub Packages) usato internamente da Cubocicloide per:

- **Scaffolding** di nuovi progetti basati su stack predefiniti (React+FastAPI, React+Django, ecc.)
- **Linting** e applicazione di regole di codice consistenti per ogni stack
- **Rules**: enforcement di convenzioni (commit, branch naming, struttura cartelle)
- **Review**: assistenza AI-driven alla code review
- **Utility**: comandi quotidiani specifici per ogni stack (es. generazione moduli, migration helper, ecc.)

### Principio guida

> **Tutto ciò che è specifico di uno stack vive nello stack.**
> Il CLI `dude` non sa nulla di React, FastAPI, Django, Express. Sa solo
> caricare un plugin stack ed eseguirne i contratti (`scaffold`, `lint`,
> `rules`, `generate`, `hooks`).

### Obiettivi non funzionali

- Distribuibile come package privato su GitHub Packages
- Installabile globalmente (`npm i -g @cubocicloide/dude`) o eseguibile via `npx`
- **Estensibile**: aggiungere uno stack non richiede una release del CLI
- **Riproducibile**: ogni scaffold deve essere ricostruibile dalle stesse risposte

---

## 2. Stack tecnologico del CLI

**Linguaggio scelto: TypeScript + Node.js (>= 20)**

| Concern             | Libreria                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| CLI framework       | [`citty`](https://github.com/unjs/citty) (leggero, moderno)                                        |
| Prompt interattivi  | [`@clack/prompts`](https://github.com/natemoo-re/clack)                                            |
| Fetch stack package | npm registry + [`tiged`](https://github.com/tiged/tiged) come fallback per repo git                |
| Caricamento plugin  | `import()` dinamico da `node_modules` o cartella cache `~/.dude/stacks/`                           |
| File system         | `fs-extra` + `pathe`                                                                               |
| Template rendering  | `handlebars` o `eta`                                                                               |
| Config loader       | [`c12`](https://github.com/unjs/c12) (supporta `.ts`, `.js`, `.json`, `.yaml`)                     |
| Logging             | `consola`                                                                                          |
| Schema validation   | `zod`                                                                                              |
| Versioning          | `semver`                                                                                           |
| Git operations      | `simple-git`                                                                                       |
| Spawn comandi       | `execa`                                                                                            |
| Test runner         | `vitest`                                                                                           |
| Bundler             | `tsup` (single file build, fast)                                                                   |
| Package manager     | `pnpm` (>= 9)                                                                                      |
| Monorepo            | `pnpm workspaces` + [`turbo`](https://turbo.build/) (build/test orchestration)                     |
| Release             | [`@changesets/cli`](https://github.com/changesets/changesets) (versioning + publish multi-package) |

---

## 3. Architettura ad alto livello

```
┌─────────────────────────────────────────────────────────────┐
│  @cubocicloide/dude  (CLI runtime, stack-agnostico)         │
│  ─────────────────────────────────────────────────          │
│  • parsing comandi                                          │
│  • risoluzione stack + versione                             │
│  • download / cache stack plugin                            │
│  • esecuzione contratti del plugin                          │
│  • config loader, logger, prompts, hooks runner             │
└──────────────────────────┬──────────────────────────────────┘
                           │ carica dinamicamente
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ @cubocicloide│   │ @cubocicloide│   │ @cubocicloide│
│ /stack-react-│   │ /stack-react-│   │ /stack-nextjs│
│ fastapi      │   │ django       │   │ -fastapi     │
│              │   │              │   │              │
│ • template/  │   │ • template/  │   │ • template/  │
│ • lint       │   │ • lint       │   │ • lint       │
│ • rules      │   │ • rules      │   │ • rules      │
│ • generators │   │ • generators │   │ • generators │
│ • hooks      │   │ • hooks      │   │ • hooks      │
│ • manifest   │   │ • manifest   │   │ • manifest   │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Implicazioni

- Per aggiungere uno stack: si crea un nuovo package `@cubocicloide/stack-<nome>` e lo si aggiunge al `registry.json` (o lo si pubblica rispettando una naming convention, vedi §6.3).
- Per evolvere uno stack (regole più strict, template aggiornato, nuovo generator): basta rilasciare una nuova versione del **suo** package. Il CLI non si tocca.
- Per usare una versione specifica delle regole per un progetto legacy: si pinna la versione dello stack in `dude.config.ts`.

---

## 3.bis. Strategia monorepo (ibrida)

L'architettura plugin di §3 è **fisicamente** distribuita su più package, ma
**logicamente** lo sviluppo di CLI e stack ufficiali avviene in un **unico
monorepo** gestito con `pnpm workspaces`. Stack di terze parti (clienti,
sperimentali) restano fuori in repo separati e si agganciano tramite il
meccanismo di risoluzione §6.

### 3.bis.1. Razionale

| Vantaggio                        | Perché ci serve                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Atomic changes su contract+stack | Cambiare il contratto `defineStack` e aggiornare tutti gli stack ufficiali in **una sola PR**.           |
| DX di sviluppo                   | Lavorando sul CLI vedi immediatamente l'impatto sugli stack via symlink di pnpm (no `npm link` manuale). |
| Test E2E reali                   | I test del CLI usano gli stack reali del workspace senza pubblicare nulla.                               |
| Release indipendenti             | `changesets` versiona ogni package separatamente, pubblica solo ciò che è cambiato.                      |
| Plugin contract = SSOT           | Vive in `packages/dude/src/core/stack-contract.ts`, tutti gli stack interni lo importano via workspace.  |
| Estendibilità preservata         | Stack esterni non ufficiali continuano a funzionare via npm/git senza vivere nel monorepo.               |

### 3.bis.2. Layout del monorepo

```
cubocicloide/dude/                         ← repo monorepo
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                           ← root (private)
├── .changeset/                            ← release multi-package
├── .npmrc                                 ← registry GitHub Packages
├── ANALYSIS.md
├── README.md
├── packages/
│   └── dude/                              ← @cubocicloide/dude (CLI)
└── stacks/
    ├── react-fastapi/                     ← @cubocicloide/stack-react-fastapi
    ├── react-django/                      ← @cubocicloide/stack-react-django
    ├── react-express/                     ← @cubocicloide/stack-react-express
    └── nextjs-fastapi/                    ← @cubocicloide/stack-nextjs-fastapi
```

Stack **fuori** dal monorepo (esempi):

```
acme/stack-react-rails/                    ← repo cliente separato
@cubocicloide-labs/stack-experimental-x/   ← repo sperimentale separato
```

### 3.bis.3. File chiave alla root

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "stacks/*"
```

`package.json` (root, privato, non pubblicato):

```json
{
  "name": "cubocicloide-dude-workspace",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --parallel",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset publish"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "@changesets/cli": "^2.27.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

### 3.bis.4. Dipendenza stack → CLI in workspace

`stacks/react-fastapi/package.json`:

```json
{
  "name": "@cubocicloide/stack-react-fastapi",
  "version": "0.1.0",
  "peerDependencies": {
    "@cubocicloide/dude": "workspace:^"
  },
  "devDependencies": {
    "@cubocicloide/dude": "workspace:*"
  }
}
```

Durante lo sviluppo, `workspace:*` fa sì che pnpm symlink la versione locale del
CLI. Al momento della pubblicazione, `changesets` riscrive `workspace:^` con la
versione semver effettiva (es. `^1.4.0`).

### 3.bis.5. Flusso di release con `changesets`

```bash
# Dopo aver modificato CLI e/o uno o più stack:
pnpm changeset                # interattivo: scegli package e bump (patch/minor/major)
# commit + PR

# Sul merge in main, la CI esegue:
pnpm changeset version        # aggiorna i package.json e i CHANGELOG.md
pnpm changeset publish        # pubblica su GitHub Packages SOLO ciò che è cambiato
```

Risultato tipico: CLI passa `1.0.0 → 1.1.0`, `stack-react-fastapi` passa
`2.1.0 → 2.2.0`, gli altri stack restano fermi. Tutto in un unico workflow,
versioni indipendenti.

### 3.bis.6. Promozione di uno stack esterno nel monorepo

Uno stack nato come repo separato (es. cliente) può essere assorbito nel
monorepo quando matura:

1. Si copia il contenuto sotto `stacks/<nome>/` preservando la storia git con `git subtree`
2. Si converte la dipendenza verso `@cubocicloide/dude` in `workspace:*`
3. Si aggiunge al `registry.json` di `packages/dude/`
4. Si rilascia con `changesets`

---

## 4. Layout del package CLI (`packages/dude/`)

> Questa è la struttura **del package CLI** all'interno del monorepo (§3.bis).
> I file di root come `pnpm-workspace.yaml`, `turbo.json`, `.changeset/`
> vivono **fuori** da qui, alla root del monorepo.

```
packages/dude/
├── package.json                      ← @cubocicloide/dude
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── bin/
│   └── dude.mjs                      ← entry point eseguibile
├── src/
│   ├── index.ts                      ← bootstrap CLI
│   ├── commands/
│   │   ├── init.ts
│   │   ├── update.ts
│   │   ├── lint.ts
│   │   ├── review.ts
│   │   ├── rules.ts
│   │   ├── generate.ts
│   │   ├── doctor.ts
│   │   └── stack.ts                  ← list/add/remove stack
│   ├── core/
│   │   ├── config.ts                 ← dude.config.ts loader
│   │   ├── registry.ts               ← registry stack
│   │   ├── stack-loader.ts           ← fetch + cache + import dinamico
│   │   ├── stack-contract.ts         ← schema zod del plugin
│   │   ├── template-runner.ts        ← rendering generico .hbs/.eta
│   │   ├── prompts.ts
│   │   ├── hooks-runner.ts
│   │   ├── auth.ts                   ← gestione token npm/github
│   │   └── logger.ts
│   ├── ai/
│   │   ├── provider.ts               ← astrazione AI (review)
│   │   └── prompts/
│   └── utils/
├── registry.json                     ← stack ufficiali Cubocicloide
└── test/
```

**Nota**: nessuna cartella `src/stacks/`. Il CLI è completamente stack-agnostico.

---

## 5. Struttura standard di un package stack

Sia che viva nel monorepo (`stacks/<nome>/`) sia che viva in un repo separato
(es. `acme/stack-react-rails/`), un package stack ha la **stessa struttura**.
La naming convention del package npm è `@<scope>/stack-<nome>`.

```
stacks/react-fastapi/                  ← oppure: cubocicloide/stack-react-fastapi/ (repo separato)
├── package.json                      ← @cubocicloide/stack-react-fastapi
├── dude.stack.json                   ← manifest macchina-leggibile
├── src/
│   ├── index.ts                      ← export defineStack({...})
│   ├── lint.ts                       ← esecuzione linter dello stack
│   ├── rules.ts                      ← regole proprie dello stack
│   ├── generators/
│   │   ├── component.ts              ← genera component React
│   │   ├── route.ts                  ← genera endpoint FastAPI
│   │   ├── model.ts                  ← SQLAlchemy + migration
│   │   └── index.ts
│   ├── hooks/
│   │   ├── pre-init.ts
│   │   └── post-init.ts
│   ├── prompts.ts                    ← prompt specifici per init
│   └── api-types.ts                  ← utility OpenAPI → TS
├── template/                         ← contenuto copiato nel progetto
│   ├── frontend/...
│   ├── backend/...
│   ├── docker-compose.yml.hbs
│   └── README.md.hbs
├── partials/                         ← parti condizionali (db, auth, ...)
│   ├── db-postgres/
│   ├── db-sqlite/
│   └── auth-jwt/
├── generator-templates/              ← template usati dai generators a runtime
│   ├── component.tsx.hbs
│   └── route.py.hbs
├── lint-configs/                     ← config esportabili per i linter
│   ├── eslint.config.mjs
│   ├── ruff.toml
│   └── prettier.config.mjs
└── dist/                             ← build (incluso in package)
```

### 5.1. Plugin contract (`src/index.ts`)

L'API che ogni stack package **deve** implementare:

```ts
import { defineStack } from "@cubocicloide/dude";

export default defineStack({
  name: "react-fastapi",
  version: "2.1.0",
  minDudeVersion: "1.0.0",
  description: "React (Vite) frontend + FastAPI backend",

  // Variabili richieste dall'init (prompt interattivo)
  variables: [
    { name: "projectName", type: "string", validate: /^[a-z][a-z0-9-]*$/ },
    {
      name: "pythonVersion",
      type: "select",
      choices: ["3.11", "3.12", "3.13"],
    },
    {
      name: "database",
      type: "select",
      choices: ["postgres", "sqlite", "none"],
    },
    { name: "useDocker", type: "boolean", default: true },
  ],

  // Mappatura template → partials condizionali
  partials: {
    "db-postgres": (ctx) => ctx.answers.database === "postgres",
    "auth-jwt": () => true,
  },

  // Scaffolding entrypoint (può essere override del default template-runner)
  async scaffold(ctx) {
    await ctx.copyTemplate("template/", ctx.dest);
    await ctx.applyPartials();
  },

  // Hook lifecycle
  hooks: {
    preInit: async (ctx) => {
      /* validazione env, versioni */
    },
    postInit: async (ctx) => {
      /* install deps, git init */
    },
  },

  // Esecuzione linter dello stack
  async lint(ctx) {
    await ctx.run("eslint", [
      "--config",
      ctx.stackPath("lint-configs/eslint.config.mjs"),
      "frontend/",
    ]);
    await ctx.run("ruff", ["check", "backend/"]);
    await ctx.run("mypy", ["backend/"]);
  },

  // Regole proprie (oltre a quelle cross-stack)
  rules: [
    {
      id: "frontend-uses-vite",
      check: async (ctx) => ctx.fileExists("frontend/vite.config.ts"),
      message: "Frontend deve usare Vite",
    },
    {
      id: "backend-pyproject-uv-managed",
      check: async (ctx) =>
        ctx.fileMatches("backend/pyproject.toml", /\[tool\.uv\]/),
      message: "Backend deve essere gestito da uv",
    },
    // ... altre regole specifiche del dominio dello stack
  ],

  // Generators disponibili
  generators: {
    component: () => import("./generators/component"),
    route: () => import("./generators/route"),
    model: () => import("./generators/model"),
  },

  // Comandi extra esposti dal CLI quando lo stack è attivo
  commands: {
    "db:migrate": () => import("./commands/db-migrate"),
    "api:types": () => import("./commands/api-types"),
  },
});
```

### 5.2. `dude.stack.json` (metadati statici)

File leggibile senza eseguire codice TypeScript — usato dal CLI prima del caricamento del modulo per il check di compatibilità:

```json
{
  "$schema": "https://cubocicloide.dev/schemas/dude-stack.json",
  "name": "react-fastapi",
  "version": "2.1.0",
  "minDudeVersion": "1.0.0",
  "entry": "dist/index.js",
  "tags": [
    "frontend:react",
    "backend:fastapi",
    "lang:typescript",
    "lang:python"
  ]
}
```

---

## 6. Distribuzione e risoluzione degli stack

### 6.1. Tre sorgenti supportate

Il CLI risolve uno stack in quest'ordine:

1. **Path locale** (per development di nuovi stack):
   ```ts
   // dude.config.ts
   stack: {
     path: "../stack-react-fastapi";
   }
   ```
2. **Package npm privato** (GitHub Packages):
   ```ts
   stack: "@cubocicloide/stack-react-fastapi@^2.0.0";
   ```
3. **Repo git** (fallback / template non pubblicati):
   ```ts
   stack: { git: 'cubocicloide/stack-react-fastapi', ref: 'v2.1.0' }
   ```

### 6.2. Cache locale

Gli stack scaricati vivono in `~/.dude/stacks/<name>/<version>/`. Il CLI controlla la cache prima di scaricare di nuovo.

### 6.3. `registry.json` lato CLI

Mappa dei nomi corti agli identificatori dei package:

```json
{
  "stacks": {
    "react-fastapi": {
      "package": "@cubocicloide/stack-react-fastapi",
      "stable": "2.1.0",
      "minimumSupported": "2.0.0"
    },
    "react-django": {
      "package": "@cubocicloide/stack-react-django",
      "stable": "1.3.0",
      "minimumSupported": "1.0.0"
    },
    "react-express": {
      "package": "@cubocicloide/stack-react-express",
      "stable": "1.0.0",
      "minimumSupported": "1.0.0"
    },
    "nextjs-fastapi": {
      "package": "@cubocicloide/stack-nextjs-fastapi",
      "stable": "1.0.0",
      "minimumSupported": "1.0.0"
    }
  }
}
```

Quando l'utente scrive `dude init --stack react-fastapi`, il CLI:

1. Cerca `react-fastapi` nel `registry.json`
2. Risolve a `@cubocicloide/stack-react-fastapi@2.1.0`
3. Lo scarica (se non in cache) tramite npm registry API o `pnpm dlx`
4. Importa dinamicamente `dist/index.js`
5. Esegue il contratto

### 6.4. Aggiungere uno stack senza aggiornare il CLI

`dude.config.ts` può dichiarare stack custom non presenti nel registry ufficiale:

```ts
export default defineConfig({
  stack: { package: "@acme/stack-react-rails@^1.0.0" },
});
```

Utile per: stack sperimentali, stack cliente-specifici, fork.

---

## 7. Sistema di configurazione

### 7.1. `dude.config.ts` (per progetto)

Generato durante `dude init`, committato:

```ts
import { defineConfig } from "@cubocicloide/dude";

export default defineConfig({
  stack: "@cubocicloide/stack-react-fastapi@2.1.0",

  // Regole cross-stack (gestite dal CLI core)
  rules: {
    commitConvention: "conventional-commits",
    branchNaming: "feature/{ticket}-{slug}",
    secretsScan: true,
  },

  // Override per le regole dello stack (opt-out/opt-in)
  stackRules: {
    disable: ["frontend-uses-vite"],
    severity: { "backend-pyproject-uv-managed": "warn" },
  },

  // AI review
  review: {
    provider: "openai",
    model: "gpt-4o",
    scope: ["src/**", "backend/app/**"],
  },
});
```

### 7.2. `dude.answers.yaml` (snapshot)

Per riproducibilità:

```yaml
stack: "@cubocicloide/stack-react-fastapi"
stackVersion: "2.1.0"
answers:
  projectName: acme-portal
  pythonVersion: "3.12"
  useDocker: true
  database: postgres
generatedAt: "2026-05-28T10:00:00Z"
dudeVersion: "1.0.0"
```

---

## 7.bis. Workflow utente (cliente che usa il CLI)

Questa sezione descrive l'esperienza pratica di chi installa e usa `dude`,
separata dallo sviluppo interno del CLI/stack.

### 7.bis.1. One-time setup (per accedere ai package privati)

Serve un Personal Access Token GitHub con scope `read:packages`.

Configurazione del registry npm — due opzioni:

**Globale** (`~/.npmrc`, valido per tutti i progetti):

```
@cubocicloide:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**Per progetto** (`.npmrc` committato nel repo, token in env):

```
@cubocicloide:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Poi:

```bash
export GITHUB_TOKEN=ghp_xxx
npm i -g @cubocicloide/dude
```

In alternativa, senza install globale: `npx @cubocicloide/dude <comando>`.

### 7.bis.2. Scenario A — Nuovo progetto con versione di stack scelta

```bash
dude init --stack react-fastapi                          # versione stable del registry
dude init --stack react-fastapi --stack-version 2.0.0    # versione esatta
dude init --stack react-fastapi --stack-version "^2.0.0" # range semver
```

Il CLI:

1. Risolve `react-fastapi` → `@cubocicloide/stack-react-fastapi@<v>` nel `registry.json`
2. Lo scarica dal registry (usando il token del cliente)
3. Lo mette in cache `~/.dude/stacks/@cubocicloide/stack-react-fastapi/<v>/`
4. Esegue il contratto `defineStack`
5. Scrive nel progetto `dude.config.ts` e `dude.answers.yaml` con la versione **pinned**:

```ts
// dude.config.ts generato
export default defineConfig({
  stack: "@cubocicloide/stack-react-fastapi@2.0.0",
});
```

Da qui chiunque cloni il progetto otterrà esattamente quella versione.

### 7.bis.3. Scenario B — Contributor che entra su un progetto esistente

```bash
git clone <repo-progetto>
cd <repo-progetto>
npm i -g @cubocicloide/dude    # se non ce l'ha già

dude lint                       # legge dude.config.ts, scarica lo stack pinned se assente in cache
dude g component Button
```

Nessuna azione manuale per "scegliere" la versione: il progetto la dichiara.

### 7.bis.4. Scenario C — Upgrade controllato dello stack

```bash
dude update --stack                  # mostra versioni disponibili + diff
dude update --stack --to 2.1.0       # bump a versione esatta
dude update --stack --to latest      # bump all'ultima stable
```

Il CLI:

1. Risolve la nuova versione
2. Re-scaffolda in una worktree temporanea partendo da `dude.answers.yaml`
3. Mostra il diff con il progetto attuale (i file utente non vengono toccati senza conferma)
4. Aggiorna `dude.config.ts` con la nuova versione una volta confermato

### 7.bis.5. Scenario D — CLI "locale" per progetti con stack legacy

Un progetto può fissare anche la versione del **CLI** come dev dependency,
utile quando si lavora con uno stack vecchio che richiede un runtime non
allineato a quello globale:

```json
{
  "devDependencies": {
    "@cubocicloide/dude": "^0.9.0"
  }
}
```

Invocazione: `pnpm exec dude <comando>` / `npx dude <comando>`. Il CLI globale
resta utile solo per `dude init` su un nuovo progetto.

### 7.bis.6. Riepilogo — "come scelgo una versione di stack?"

| Quando                                 | Come                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| Sto creando il progetto                | `dude init --stack <nome> --stack-version <X.Y.Z>`                   |
| Sto lavorando su un progetto esistente | Modifico `dude.config.ts` (`stack: '@cubocicloide/stack-...@X.Y.Z'`) |
| Voglio fare un upgrade controllato     | `dude update --stack --to X.Y.Z`                                     |

In tutti e tre i casi la versione è **dichiarata nel repo del progetto** e
auto-risolta dal CLI ai comandi successivi. Non serve mai installare
manualmente il package dello stack: lo gestisce il CLI.

---

## 8. Versionamento

### 8.1. Tre livelli

| Versione                                    | Cosa governa                         | Dove vive                                |
| ------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| **CLI** (`@cubocicloide/dude`)              | runtime, contratti plugin            | `package.json` del CLI                   |
| **Stack package** (`@cubocicloide/stack-*`) | template + lint + rules + generators | `package.json` dello stack               |
| **Contract schema**                         | API che il plugin deve implementare  | costante in `src/core/stack-contract.ts` |

### 8.2. Compatibility check

Il plugin dichiara `minDudeVersion`. Il CLI rifiuta plugin che richiedono un runtime superiore:

```
✖  Stack @cubocicloide/stack-react-fastapi@3.0.0 requires dude >= 2.0.0
   You have: 1.4.2
   Run: npm i -g @cubocicloide/dude@latest
```

E viceversa il CLI controlla che il plugin esponga la versione del contract attesa.

### 8.3. Release policy

**CLI:**

- Patch: bugfix runtime
- Minor: nuovi comandi core, nuove API non-breaking per i plugin
- Major: breaking change del contract plugin

**Stack package:**

- Patch: fix di template o regole
- Minor: nuove regole opzionali, nuovi generators, nuove partial
- Major: cambio struttura output, dipendenze incompatibili, regole nuove obbligatorie

---

## 9. Stack pianificati e cosa contengono

> Ogni voce è un'**istanza** del contratto §5.1. La sintesi qui sotto è ciò
> che il package dello stack deve implementare, **non** ciò che vive nel
> CLI.

### 9.1. `@cubocicloide/stack-react-fastapi`

**Template:**

- Frontend: React 19 + Vite + TypeScript + TanStack Query/Router
- Backend: FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2
- Docker Compose con Postgres
- Tipi TS generati da OpenAPI

**Lint (eseguito da `dude lint`):**

- Frontend: ESLint v9 flat (`@typescript-eslint/strict-type-checked`, `react`, `react-hooks`, `import`, `jsx-a11y`, `unicorn`) + Prettier 3 (+ `prettier-plugin-tailwindcss`)
- Backend: `ruff check`, `ruff format`, `mypy --strict`

**Rules (oltre a quelle cross-stack):**

- `frontend-uses-vite`: deve esserci `vite.config.ts`
- `backend-pyproject-uv-managed`: `pyproject.toml` con `[tool.uv]`
- `frontend-no-axios`: usa fetch wrapper generato dai tipi
- `backend-no-sync-endpoints`: tutti gli endpoint devono essere `async def`
- `api-types-up-to-date`: i tipi TS sono sincronizzati con lo schema OpenAPI

**Generators:**

- `dude g component <Name>` → componente React + test
- `dude g route <name>` → endpoint FastAPI + schema Pydantic + test
- `dude g model <Name>` → SQLAlchemy model + Alembic migration
- `dude g feature <name>` → struttura completa frontend+backend per una feature

**Hooks:**

- `preInit`: verifica `node>=20`, `python>=3.11`, `uv`, `pnpm`
- `postInit`: `pnpm i`, `uv sync`, `git init`, prima migration

**Commands extra:**

- `dude db:migrate` → wrapper Alembic
- `dude api:types` → rigenera tipi TS da OpenAPI
- `dude dev` → avvia FE + BE in parallelo

### 9.2. `@cubocicloide/stack-react-django`

**Template:** React + Vite + TS / Django 5 + DRF + drf-spectacular.

**Lint:** stesso preset FE; `ruff` con regole `DJ`, `mypy` + `django-stubs`.

**Rules specifiche:**

- `backend-uses-drf`: `INSTALLED_APPS` contiene `rest_framework`
- `backend-spectacular-configured`: schema OpenAPI esposto
- `frontend-uses-csrf-helper`: chiamate non-GET passano per helper CSRF

**Generators:**

- `dude g app <name>` → `manage.py startapp` + register in settings
- `dude g model <Name>` → model + serializer DRF + viewset + URL
- `dude g component <Name>`

**Commands extra:** `dude db:migrate`, `dude api:types`, `dude manage <args>`.

### 9.3. `@cubocicloide/stack-react-express`

**Template:** React + Vite + TS / Express + TypeScript + Prisma + zod.

**Lint:** ESLint+Prettier unico per FE e BE.

**Rules:**

- `backend-zod-on-all-routes`: ogni handler ha un validator zod
- `prisma-schema-formatted`
- `no-raw-sql-in-handlers`

**Generators:** `component`, `route` (con zod schema), `model` (Prisma).

### 9.4. `@cubocicloide/stack-nextjs-fastapi`

**Template:** Next.js 15 App Router + Server Components / FastAPI come §9.1.

**Lint:** ESLint flat + `next/core-web-vitals`.

**Rules:**

- `prefer-server-components`: warning su `'use client'` in cima alla page senza ragione
- `no-client-side-secrets`
- `server-actions-typed`

**Generators:** `page`, `server-action`, `component`, `route` (FastAPI).

### 9.5. Regole **cross-stack** (gestite dal CLI core, non dagli stack)

Eseguite sempre, indipendentemente dallo stack, da `dude rules check`:

- Commit messages: Conventional Commits (`commitlint`)
- Branch naming: regex configurabile
- PR title: stessa regex
- No secrets: scan via `gitleaks` integrato
- Lockfile presente per i package manager dichiarati
- `dude.config.ts` e `dude.answers.yaml` presenti e validi

Queste sono le **uniche** regole che vivono nel CLI. Tutto il resto è dello stack.

---

## 10. Comandi CLI previsti

```bash
# Scaffolding
dude init                                  # interattivo
dude init --stack react-fastapi
dude init --stack react-fastapi --stack-version 2.0.0
dude init --from dude.answers.yaml

# Aggiornamento
dude update                                # check versione CLI
dude update --stack                        # check + upgrade dello stack package
dude update --stack --apply                # applica diff su template (con merge)

# Linting e regole
dude lint                                  # delega allo stack
dude lint --fix
dude rules check                           # cross-stack + stack rules
dude rules check --staged
dude rules list                            # mostra tutte le regole attive con sorgente

# Generatori
dude generate <kind> <name>                # delega allo stack
dude g component Button

# Stack
dude stack info                            # info sullo stack del progetto
dude stack list                            # stack disponibili nel registry
dude stack add <name>                      # aggiunge stack al progetto multi-stack (futuro)

# Review
dude review                                # AI review del diff vs main

# Diagnostica
dude doctor                                # check env + plugin attivo
dude info
```

---

## 11. Distribuzione su GitHub Packages

> Vedi anche §3.bis per il flusso di release multi-package via `changesets`,
> e §7.bis per il setup lato utente.

### 11.1. CLI

`packages/dude/package.json`:

```json
{
  "name": "@cubocicloide/dude",
  "version": "0.1.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "bin": { "dude": "./bin/dude.mjs" },
  "files": ["dist", "bin", "registry.json"]
}
```

### 11.2. Stack package

Stesso pattern per ogni package sotto `stacks/<nome>/`, es. `@cubocicloide/stack-react-fastapi`:

```json
{
  "name": "@cubocicloide/stack-react-fastapi",
  "version": "1.0.0",
  "main": "dist/index.js",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  },
  "files": [
    "dist",
    "template",
    "partials",
    "generator-templates",
    "lint-configs",
    "dude.stack.json"
  ],
  "peerDependencies": {
    "@cubocicloide/dude": "^1.0.0"
  }
}
```

### 11.3. Workflow di rilascio (monorepo)

Un **unico** workflow GitHub Actions `release.yml` alla root del monorepo,
basato sull'action ufficiale di `changesets`:

1. Su push a `main`, l'action apre/aggiorna una "Version Packages" PR che
   contiene i bump versione e i CHANGELOG generati dai changeset accumulati.
2. Sul merge di quella PR, l'action esegue `pnpm changeset publish`, che
   pubblica su GitHub Packages **solo** i package toccati.
3. Gli stack esterni al monorepo (clienti, sperimentali) hanno un loro
   `release.yml` su tag `v*` indipendente.

### 11.4. Lato utente

Vedi §7.bis.1.

---

## 12. Piano di implementazione (incrementale)

### Fase 0 — Bootstrap monorepo

1. Inizializzare il repo `cubocicloide/dude` come **monorepo**:
   - `package.json` root (privato), `pnpm-workspace.yaml`, `turbo.json`
   - Setup `changesets` (`pnpm dlx @changesets/cli init`) con config per GitHub Packages
   - `.npmrc` con registry `@cubocicloide` puntato a GitHub Packages
   - `.github/workflows/ci.yml` (lint + test su PR via `turbo`)
   - `.github/workflows/release.yml` (changesets action: PR "Version Packages" + publish)
2. Bootstrap del package CLI sotto `packages/dude/`:
   - `package.json` (`@cubocicloide/dude`), `tsconfig.json`, `tsup.config.ts`
   - `bin/dude.mjs` + comando `dude --version`
3. Setup tooling condiviso: `vitest`, `eslint`, `prettier`, `lefthook`
4. Smoke test: build, test, `dude --version` funzionante

### Fase 1 — Core runtime

1. `core/logger.ts`
2. `core/config.ts` (loader `c12` + zod schema per `dude.config.ts`)
3. `core/stack-contract.ts` (zod schema + types per `defineStack`)
4. `core/registry.ts` (lettura `registry.json`)
5. `core/stack-loader.ts` (risoluzione + download via npm/`pnpm dlx` + cache + `import()`)
6. `core/auth.ts` (token npm/github)
7. `core/prompts.ts`
8. `core/template-runner.ts` (rendering Handlebars/Eta — utility usata dagli stack)
9. `core/hooks-runner.ts`
10. Export pubblico di `defineStack`, `defineConfig`, helper types

### Fase 2 — Comando `init`

1. Risoluzione stack (flag o prompt o `dude.config.ts`)
2. Caricamento plugin
3. Prompt variabili dichiarate dal plugin
4. Esecuzione `preInit` hook
5. Chiamata `scaffold()` del plugin (default: copia `template/` con render Handlebars)
6. Applicazione partial
7. Esecuzione `postInit` hook
8. Generazione `dude.config.ts` + `dude.answers.yaml`

### Fase 3 — Primo stack reale

- Creare `stacks/react-fastapi/` nel monorepo (`@cubocicloide/stack-react-fastapi`)
- Implementare contratto `defineStack` minimo (solo template + scaffold + hooks)
- Dipendenza verso CLI in `workspace:*` per development
- Pubblicare `0.1.0` su GitHub Packages via changesets
- Validare end-to-end `dude init --stack react-fastapi`

### Fase 4 — Lint e rules

1. `dude lint` → invoca `stack.lint()`
2. `dude rules check`:
   - Esegue regole cross-stack core
   - Esegue regole dichiarate da `stack.rules`
   - Applica override da `dude.config.ts → stackRules`
3. Aggiungere regole reali al primo stack

### Fase 5 — Generators

1. `dude generate <kind> <name>` → `stack.generators[kind]`
2. Helpers nel core (`core/template-runner`) usabili dai generators degli stack
3. Aggiungere generators al primo stack

### Fase 6 — Comandi extra dello stack

1. Supporto a `stack.commands` registrato dinamicamente come sottocomando del CLI
2. Esempi: `dude db:migrate`, `dude api:types` per `stack-react-fastapi`

### Fase 7 — Comando `update`

1. Check versione CLI (npm registry)
2. Check versione stack package
3. Diff su template (worktree temporanea con re-scaffold dalle `answers.yaml`) per facilitare il merge

### Fase 8 — Comando `review` (AI)

1. Astrazione provider OpenAI/Anthropic
2. Input: diff git + file modificati
3. Prompt review può essere customizzato dallo stack (`stack.reviewPrompts`)
4. Output: commenti strutturati

### Fase 9 — Stack aggiuntivi

- `stack-react-django`, `stack-react-express`, `stack-nextjs-fastapi` come nuove cartelle sotto `stacks/`
- Ogni stack segue la struttura standard §5
- Rilasciati con changesets insieme (o separatamente) al resto del monorepo

### Fase 10 — Polish

- `dude doctor`
- `dude stack info` / `list`
- Telemetria opt-in
- Docs site (Astro Starlight o VitePress) con documentazione del contract

---

## 13. Decisioni aperte (da confermare prima di iniziare)

### 13.1. Decisioni già prese

- **Linguaggio CLI**: TypeScript + Node.js >= 20
- **Architettura**: plugin-based, stack-agnostico
- **Layout repo**: **monorepo ibrido** (pnpm workspaces + turbo + changesets) per CLI + stack ufficiali; stack esterni in repo separati
- **Naming package**: `@cubocicloide/dude` per il CLI, `@cubocicloide/stack-<nome>` per gli stack
- **Distribuzione**: GitHub Packages (npm registry privato)
- **Versionamento**: semver indipendente per CLI e per ogni stack, gestito da `changesets`

### 13.2. Da decidere

1. **Fetch stack non-npm**: supportare fin da subito anche `path:` e `git:` come sorgenti, o solo registry npm in v1?
2. **Package manager dei progetti generati**: il CLI assume `pnpm`/`uv` ovunque o si adatta a `npm`/`yarn`/`bun`/`poetry`?
3. **Stack cache**: implementazione manuale del fetch dal registry (controllo totale) o delega a `pnpm dlx` (meno codice)?
4. **Struttura dei progetti generati**: monorepo Turbo/Nx o multi-cartella semplice (decisione per-stack)?
5. **AI provider per `review`**: solo OpenAI all'inizio o astrazione subito (OpenAI + Anthropic)?
6. **Telemetria**: opt-in, opt-out, o assente?
7. **Distribuzione del CLI**: solo npm package o anche binario standalone (`bun build --compile`)?
8. **Registry**: solo bundled in `packages/dude/registry.json` o anche remoto fetchabile (`https://cubocicloide.dev/dude/registry.json`)?
9. **Multi-stack per progetto**: deve essere supportato (un progetto con più stack attivi) o un progetto = uno stack?

---

## 14. Prossimi passi concreti

Alla prossima sessione:

1. Rispondere alle decisioni aperte in §13.2 — in particolare 1, 2, 3, 9 sono bloccanti per la Fase 0
2. Bootstrap del **monorepo** (Fase 0): `pnpm-workspace.yaml`, `turbo.json`, `changesets`, `packages/dude/` scheletro
3. Implementare il **contract plugin** (`defineStack`) e lo **stack-loader** (Fase 1) — sono il cuore architetturale
4. Creare uno stack di test locale sotto `stacks/test-fixture/` per validare il flusso `init` end-to-end senza dover ancora pubblicare
5. Pubblicare la prima coppia `@cubocicloide/dude@0.1.0` + `@cubocicloide/stack-react-fastapi@0.1.0` su GitHub Packages via changesets (Fase 3)
