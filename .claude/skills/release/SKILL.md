# Skill: release

Use this skill when asked to publish a new version of one or more packages in
the monorepo (`@cubocicloide/dude` and/or `@cubocicloide/stack-react-fastapi`).

The release flow uses **Changesets** + **GitHub Actions** CI. You do not publish
directly — you record the intent and CI does the rest.

---

## Step 1 — Verify working tree is clean

```bash
git status
```

All relevant changes must be committed before creating a changeset.
If there are unstaged changes, commit or stash them first.

---

## Step 2 — Record a changeset

```bash
make changeset
# equivalent to: pnpm changeset
```

The interactive prompt asks:
1. **Which packages** have changed? (select with space, confirm with enter)
2. **Bump type** for each package:
   - `patch` — bug fix, no new public API
   - `minor` — new backwards-compatible feature
   - `major` — breaking change

A `.changeset/<random-slug>.md` file is created. Review and edit it if the
auto-generated summary needs more detail.

```bash
git add .changeset/
git commit -m "chore: add changeset for <brief description>"
git push origin master
```

---

## Step 3 — CI opens the "Version Packages" PR

After pushing, the **Release** GitHub Actions workflow detects the new changeset
and opens (or updates) a PR titled **"Version Packages"**. That PR:
- Bumps `version` fields in the affected `package.json` files
- Updates `CHANGELOG.md` entries from the collected changesets
- Removes the consumed `.changeset/*.md` files

Use the GitHub MCP tools to inspect or merge the PR:

```
mcp: github_repo → list pull requests → find "Version Packages"
mcp: github_repo → get pull request details
mcp: github_repo → merge pull request   (squash)
```

Or merge it through the GitHub UI.

---

## Step 4 — CI publishes to GitHub Packages

Merging the "Version Packages" PR triggers the **Publish** job in CI, which
runs `pnpm publish --filter` for each bumped package and pushes to
`https://npm.pkg.github.com/@cubocicloide/`.

Monitor the Actions run:

```
mcp: github_repo → list workflow runs → find the latest "Release" run
mcp: github_repo → get workflow run details
```

---

## Step 5 — Verify the published package

```bash
# Confirm the new version appears in the registry
npm view @cubocicloide/dude --registry=https://npm.pkg.github.com
npm view @cubocicloide/stack-react-fastapi --registry=https://npm.pkg.github.com
```

---

## Hotfix releases (urgent patch on an already-published version)

1. Create a branch from the release tag: `git checkout -b hotfix/vX.Y.Z vX.Y.Z`
2. Apply the fix and commit.
3. `make changeset` → `patch`.
4. Push and open a PR against `master`.
5. After merge, the normal CI flow publishes the patch.

---

## Notes

- Do **not** manually edit `package.json` version fields — changeset tooling
  manages these.
- Do **not** run `pnpm publish` locally — the CI job handles auth via
  `GITHUB_TOKEN`.
- The `CHANGELOG.md` in each package is auto-generated from changeset summaries;
  the "Unreleased" section in `stacks/react-fastapi/CHANGELOG.md` is a
  hand-maintained supplement for in-progress notes.
