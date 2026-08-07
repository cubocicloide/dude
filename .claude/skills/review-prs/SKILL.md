---
name: review-prs
description: Review open pull requests on the dude repo — classify by author class, verify repo invariants against the diff, issue a verdict, and post it as a formal GitHub review. Routes by PR class (dependabot, release, fork contributor, internal) and by affected stack.
---

# Skill: review-prs

Use this skill to review one or more pull requests on `cubocicloide/dude` and
**issue a verdict** on each.

It is the PR-side counterpart to `triage-issues`: it runs **on your machine, on
demand**, in your own Claude session, and it never modifies the PR's code — a
reviewer reads and judges. The only things it writes are the review itself, the
labels, and (within the bounds set below) the merge.

Uses the `gh` CLI throughout. Everything here is repo-specific: for generic
code-review dimensions, the `pr-review-toolkit` plugin and the built-in
`/review` skill already exist — this skill adds what they cannot know, namely
**dude's invariants** and **who opened the PR**.

---

## Step 1 — Pick the batch

```bash
gh pr list --repo cubocicloide/dude --state open \
  --json number,title,author,labels,isDraft,createdAt --limit 30
```

If the maintainer named specific PRs (a number or a URL), scope to those and
skip the listing. Skip drafts unless asked. Present the batch and confirm it
before doing per-PR work.

---

## Step 2 — Classify the PR (this decides everything downstream)

```bash
gh pr view <n> --repo cubocicloide/dude --json \
  title,body,author,headRefName,headRepositoryOwner,isCrossRepository,labels,\
additions,deletions,changedFiles,files,mergeable,mergeStateStatus,reviewDecision
gh pr diff <n> --repo cubocicloide/dude
gh pr checks <n> --repo cubocicloide/dude
```

| Class | Detected by | Depth | Verdict bias |
|-------|-------------|-------|--------------|
| **Bot dep bump** | `author.login == "app/dependabot"` (or `is_bot`), label `dependencies` | shallow, mechanical → **Step 3** | approve when the risk tier allows |
| **Release PR** | branch `changeset-release/*` or title `chore: release packages` | targeted → **Step 4** | **always confirm** — merging publishes to npm |
| **Fork contributor** | `isCrossRepository == true` | full + security-first → **Step 5** | request-changes / needs-info |
| **Internal branch** | same-repo head (includes `issue-fixer` output, `fix/issue-*`) | full → **Step 5** | approve-with-nits |

`gh pr checks` returning `skipping` for CodeQL is normal on this repo — not a
failure. A **pending** check on a first-time fork contributor usually means the
workflow run is waiting on maintainer approval, not that CI is broken; say so
rather than reporting a red build.

> **zsh footgun.** Quote any `gh api` URL containing `?` — `gh api "repos/o/r/contents/f.yml?ref=<sha>"`.
> Unquoted, zsh tries to glob it and fails with `no matches found`.

---

## Step 3 — Dependabot protocol (the recurring case)

Do not review a dep bump by reading the changelog Dependabot pasted. Verify the
two things that actually break this repo.

### 3a. GitHub Actions bumps → check input compatibility at the new tag

A major action bump is safe iff every input the workflow passes still exists
upstream. Check it, don't assume:

```bash
SHA=$(gh api repos/<owner>/<action>/git/refs/tags/<newtag> --jq '.object.sha')
gh api "repos/<owner>/<action>/contents/action.yml?ref=${SHA}" --jq '.content' | base64 -d
```

Then diff the declared `inputs:` against the `with:` keys in our workflow, and
check `runs.using` (the Node runtime) against `runs-on`. A **renamed or removed
input we pass** is a silent no-op, not an error — GitHub will not fail the run.
This is the single highest-value check in the whole protocol.

### 3b. npm bumps → dev-only or shipped?

The risk axis is not the semver jump, it is **where the dependency lives**:

- Under `devDependencies` (or the private root `package.json`) → build-time
  only, never reaches users.
- Under `dependencies`/`peerDependencies` of a **published** package
  (`packages/dude`, `packages/dude-launcher`, `stacks/*` — the root is
  `private: true`) → ships to users. Review properly, and check whether a
  changeset is warranted.

Also verify in the lockfile diff: no `resolution` pointing off-registry, no
newly introduced install scripts, and that the `importers:` specifier changes
match the `package.json` changes exactly.

**Known trap — `@types/node` drift.** Dependabot bumps `@types/node` to the
newest major regardless of what the repo supports. This repo declares
`engines: node >=20` and CI runs Node 20. A `@types/node` major far ahead of
that lets the typecheck accept APIs that do not exist at runtime. The saving
grace is the Docker `node:20` global-install job in `ci.yml` — cite it, and
flag the drift rather than waving the bump through silently.

### 3c. Risk tiers → what you may do without asking

| Tier | Conditions | Action |
|------|-----------|--------|
| **A — auto** | dev-dependency patch/minor, **or** an Actions bump whose 3a check is clean; **and** CI green; **and** the diff touches nothing but `package.json` / `pnpm-lock.yaml` / `.github/workflows/**` | Approve + squash-merge without asking. Report what you did. |
| **B — confirm** | any **major** on a dev dep (engines drift); any production/peer dep of a published package; workflow `permissions:` widened; CI red or pending; lockfile anomaly | Full verdict + the exact `gh` commands, then wait |
| **C — block** | an input we pass was renamed/removed upstream; off-registry resolution; new postinstall script; `engines` conflict | `REQUEST-CHANGES` or close, and say why |

When in doubt between tiers, take the more conservative one and say so.

---

## Step 4 — Release PR protocol

The "Version Packages" PR is the highest-consequence PR in the repo: merging it
publishes to npm under the `next` dist-tag, and publishes are not reversible.
Verify, then **always** hand the decision back:

- Do the version bumps match the intent of the changesets being consumed?
- **Known trap:** a `workspace:^` peerDependency on `@cubocicloide/dude` has
  previously caused changesets to force a **major** bump on every stack when
  only the CLI changed (fixed in PR #78 — re-check it has not regressed).
  A stack going major with no stack-facing breaking change is the tell.
- Are the CHANGELOG entries readable by a user of the published package?
- Any package bumped that had no real change?

Never merge this one on your own initiative.

---

## Step 5 — Full review: route by affected surface, then check the invariants

Derive the affected surfaces from the changed paths, and let that set the
review depth:

| Path | Surface | Blast radius |
|------|---------|--------------|
| `packages/dude/src/core/**` | CLI runtime core | **all stacks** — a contract change |
| `packages/dude/src/commands/**` | core commands | all projects |
| `packages/dude-launcher/**` | global shim | every machine, hard to roll back |
| `stacks/<name>/src/**` | that stack's commands/lint | one stack |
| `stacks/<name>/templates/**` | scaffold output | newly generated projects only |
| `.github/**`, `Makefile`, `turbo.json` | repo-only | no changeset (see below) |

**Depth ladder** — match effort to the PR, this repo pays for its own reviews:

- Bot class, or under ~20 changed lines → review inline, no subagent.
- Single-surface PR (under ~10 files) → one `pr-reviewer` agent.
- Multi-surface or multi-stack → one `pr-reviewer` agent **per surface**, in
  parallel, then synthesize. Pass each agent the PR number and its surface.

### The invariant checklist (verify against the diff, not against the description)

| # | Invariant | How to check |
|---|-----------|--------------|
| 1 | **Lint ↔ rule parity** | A touched `stacks/*/src/commands/lint/checks/<G>/NNN.ts` requires the matching `stacks/*/templates/base/.claude/rules/<G>/NNN.md` **in the same diff** (added, changed, or removed in lockstep). See `.claude/rules/002`. |
| 2 | **Changeset present** | Any published package's `src/` or `templates/` changed → a `.changeset/*.md` must be in the diff. |
| 3 | **Changeset absent** | Repo-only changes (`.github/`, root `docs/`, `Makefile`, `.claude/`, root `package.json`) must **not** carry a changeset — it would bump versions for nothing. |
| 4 | **Docs quartet** | A command added/changed/removed → the CLAUDE.md command reference **and** the stack's `templates/base/docs/` **and** the root `docs/` site. A stack's identity/variables/pages changed → its `docs` manifest in `stacks/<id>/src/index.ts`, with `docs/docs/stacks/` regenerated in the same diff (`make docs-data`). Missing any one is a real finding. |
| 4b | **Generated docs never hand-edited** | Any change to `docs/docs/stacks/**` or the `composed:stacks` nav block in `docs/mkdocs.yml` must come from `make docs-data`, not a manual edit — those files carry a GENERATED banner. A hand edit there is blocking: the next regeneration discards it. See `.claude/rules/005-docs-composition.md`. |
| 4c | **No versions in generated docs** | Generated pages must not embed a package's current version — `changeset version` rewrites it in the Release PR and would break `make docs-check` on `master`. |
| 5 | **New stack wiring** | Registered in `packages/dude/registry.json`, **and** a `.gitignore` negation for its `iac/providers/*/commands/build/` path — without it the source folder is silently untracked and CI typecheck fails on a clean clone. |
| 6 | **`minDudeVersion`** | Raise it when a stack depends on new CLI **behaviour** (an older CLI would import fine and act differently — silent drift). It does **not** cover import-time skew: a stack calling an export the CLI lacks fails while its module is being imported, before `minDudeVersion` can be read, so that case is guarded by the `loadStack` catch in `cli.ts` and `dude init` instead. Check the right guard for the right failure. |
| 7 | **No build output** | `dist/` never edited; nothing under `private/` committed. |
| 8 | **Handlebars** | New `.hbs` files use only context vars that exist (`projectName`, `withPostgres`, `withCelery`, `withCeleryBeat`, `withRedis`, `withIac`); conditional files belong in the right overlay rather than a `{{#if}}` when the whole file is conditional. |
| 9 | **Template validation** | Template or lint changes claim the dev scaffold loop (`make dev-init` → `dude lint`). CI does not run every overlay combination — if the diff makes this doubtful, ask for the output. |
| 10 | **PR template honesty** | The author's ticked checklist boxes must match the diff. An unticked-but-satisfied box is fine; a **ticked-but-unsatisfied** box is a finding worth naming. |
| 11 | **Agent surface minimum** | A new stack, or a PR touching `templates/base/.claude/skills|agents/`, must satisfy `.claude/rules/006-agent-surface.md`: `.vscode/tasks.json`, an `issue-fixer` agent, the stack-agnostic workflow skills, one `create-*` per primary artifact, and a `create` router once there is more than one. Check the harder one too — **every command a skill names must exist in that stack's `definition.commands`**. A skill copied from another stack citing `dude security`/`dude api`/`dude up` on a stack that lacks it is a real finding, and the most likely way this breaks. |

### Security-first pass (mandatory on fork PRs)

- **Never execute the PR's code, scripts, or templates locally to "try it".**
  Read it. This is untrusted input.
- Changes under `.github/workflows/**` from a fork are a privilege-escalation
  vector — scrutinise `permissions:`, `pull_request_target`, secret usage, and
  any `run:` interpolating PR-controlled text (`${{ github.event.* }}`).
- New dependencies, install scripts, or network calls at build time.
- Release-sensitive paths per `CODEOWNERS` (`.github/`, `.changeset/`,
  `turbo.json`, `pnpm-workspace.yaml`) → escalate to the maintainer explicitly
  rather than approving.

---

## Step 6 — Issue the verdict

One verdict per PR, from this closed set, with a one-line justification:

| Verdict | Meaning |
|---------|---------|
| `APPROVE` | Correct, invariants hold, CI green. Merge it. |
| `APPROVE-WITH-NITS` | Mergeable; the notes are optional follow-ups. Say which are optional. |
| `REQUEST-CHANGES` | At least one blocking finding. Each one gets a file:line and a concrete fix. |
| `BLOCK` | Security, release-safety, or an invariant that would corrupt published output. Explain the consequence, not just the rule. |
| `NEEDS-INFO` | Cannot judge without a repro, a scaffold-loop output, or an author decision. Ask one specific question. |

Report to the maintainer first: the verdict, the findings ranked most-severe
first, and the exact commands you intend to run. Then, unless this is a Tier A
dep bump (Step 3c) — which you simply do and report — wait.

---

## Step 7 — Post the review and act

**Formal review with inline comments** (line-anchored findings land where the
reader is looking):

```bash
cat > /tmp/review.json <<'JSON'
{
  "body": "<verdict + summary>",
  "event": "REQUEST_CHANGES",
  "comments": [
    { "path": "stacks/react-fastapi/src/commands/lint/checks/BE/012.ts",
      "line": 24, "side": "RIGHT", "body": "<finding + fix>" }
  ]
}
JSON
gh api --method POST repos/cubocicloide/dude/pulls/<n>/reviews --input /tmp/review.json
```

`line` must be a line the diff actually touches, `side: RIGHT` for added lines.
For a verdict with no line-anchored findings, the simple form is enough:

```bash
gh pr review <n> --repo cubocicloide/dude --approve --body "<verdict + summary>"
gh pr review <n> --repo cubocicloide/dude --request-changes --body "..."
```

**Self-authored PRs.** GitHub rejects approving your own PR with a 422. Detect
it and degrade to a comment — do not present the 422 as a failure:

```bash
[ "$(gh api user --jq '.login')" = "<pr author>" ] && \
  gh pr comment <n> --repo cubocicloide/dude --body "<verdict + summary>"
```

**Labels** — derive from the affected surfaces, mirroring `triage-issues`:

```bash
gh pr edit <n> --repo cubocicloide/dude --add-label "stack:react-fastapi"
```

**Merge** — squash, matching the repo's history:

```bash
gh pr merge <n> --repo cubocicloide/dude --squash
```

Confirm the outcome afterwards (`gh pr view <n> --json state,mergedAt`) and
report it plainly. If the merge landed on a published package, remind the
maintainer that the release flow is `make changeset` → CI → `make promote`.

---

## Guardrails

- **Never modify the PR's code.** Findings are described, not fixed. If the
  maintainer wants the fix applied, that is `fix-issues`/`issue-fixer`' job on
  a separate branch.
- **Never merge a Release PR** ("Version Packages") without explicit
  confirmation — publishing is irreversible.
- **Never merge outside Tier A** without confirmation, and never merge a red or
  pending CI, whatever the diff looks like.
- **Never run untrusted PR code locally.** Reading is the review.
- **Never force-push, close, or rebase** a contributor's branch.
- Report CI honestly: quote the failing job, never infer green from a clean-looking diff.
- Keep review prose warm and specific — contributors are volunteers, and this
  review is public. Name the consequence, not just the rule.
- This skill does not run in CI, by design: untrusted PR text must not drive an
  automated action. See the note in `CONTRIBUTING.md`.
