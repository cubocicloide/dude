# dude — monorepo Makefile
# Self-documenting: run `make` or `make help` to list available targets.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Optional local secrets (gitignored). Currently just GITHUB_TOKEN_ADMIN — a
# write:packages token used by `make promote`/`make dist-tags` so maintainers
# don't need a more-privileged token in their everyday shell GITHUB_TOKEN.
-include .env
export GITHUB_TOKEN_ADMIN

# Pass extra args to the local CLI: `make cli ARGS="init --stack react-fastapi"`
ARGS  ?=

# Local scaffold test — override with: make dev-init STACK=react-fastapi OUT=test-local
# STACK_OPTS defaults to the full matrix so the scaffold exercises every overlay.
# Override to test a subset: make dev-init STACK_OPTS="--database postgres"
STACK      ?= react-fastapi
OUT        ?= test-local
STACK_OPTS ?= --database postgres --celery --celerybeat --iac aws-eks

# Host port for `make docs` (root MkDocs site) — mirrors the scaffold's `dude docs`.
DOCS_PORT  ?= 8001

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@printf "\n\033[1mdude — available targets\033[0m\n\n"
	@awk 'BEGIN {FS = ":.*##"} \
		/^[a-zA-Z0-9_.-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' \
		$(MAKEFILE_LIST)
	@printf "\n"

##@ Setup

.PHONY: install
install: ## Install all workspace dependencies via pnpm
	pnpm install

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	pnpm run clean || true
	find . -name "node_modules" -type d -prune -exec rm -rf {} +
	find . -name "dist" -type d -prune -exec rm -rf {} +
	find . -name ".turbo" -type d -prune -exec rm -rf {} +

##@ Develop

.PHONY: build
build: ## Build every package via turbo
	pnpm run build

.PHONY: dev
dev: ## Watch and rebuild all packages on source change — keep running in a second terminal for HMR
	pnpm run dev

.PHONY: cli
cli: ## Run the local CLI — usage: make cli ARGS="init --stack react-fastapi"
	pnpm --filter @cubocicloide/dude exec dude $(ARGS)

.PHONY: dev-run
dev-run: ## Run a command inside the scaffold — make dev-run ARGS="lint" [OUT=test-local]
	@if [ -z "$(ARGS)" ]; then \
		printf "  \033[31m✗\033[0m  No command given. Usage: make dev-run ARGS=\"lint\"\n"; \
		exit 1; \
	fi
	@cd private/examples/$(OUT) && pnpm dude $(ARGS)

.PHONY: dev-init
dev-init: ## Tear down, re-scaffold, and relink — make dev-init [STACK=react-fastapi] [OUT=test-local] [STACK_OPTS="…"]
	@# 1. Tear down any running Docker environment from a previous scaffold run so
	@#    we don't leak containers, named volumes, or locally-built images.
	@if [ -f "private/examples/$(OUT)/docker-compose.yml" ]; then \
		printf "  \033[33m→\033[0m  Stopping Docker environment in private/examples/$(OUT)…\n"; \
		cd "private/examples/$(OUT)" && docker compose down --volumes --rmi local 2>/dev/null || true; \
	fi
	@# 2. Remove the old scaffold so we start completely clean.
	@rm -rf private/examples/$(OUT)
	@# 3. Rebuild BOTH the CLI runtime and the stack: the `dude` binary runs from
	@#    packages/dude/dist, so a stack-only build leaves the CLI stale.
	@#    Turbo caches unchanged packages so this is a no-op when nothing changed.
	pnpm --filter @cubocicloide/dude --filter @cubocicloide/stack-$(STACK) build
	@# 4. Scaffold. Default STACK_OPTS enables the full overlay matrix so every
	@#    template is exercised. Pass STACK_OPTS="" to test the minimal base.
	node packages/dude/bin/dude.mjs init --stack ./stacks/$(STACK) --yes $(STACK_OPTS) private/examples/$(OUT)
	@# 5. Wire the local binary so `pnpm dude <cmd>` inside the scaffold resolves
	@#    to the live source tree rather than any globally-installed dude.
	@mkdir -p private/examples/$(OUT)/node_modules/.bin
	@ln -sfn "$(CURDIR)/packages/dude/bin/dude.mjs" \
		"private/examples/$(OUT)/node_modules/.bin/dude"
	@# 6. Install dev dependencies in frontend/ and e2e/ so that `dude review`
	@#    (eslint) works immediately without a separate install step.
	@#    Uses npm (not pnpm) to avoid pnpm resolving the dude monorepo workspace
	@#    instead of the scaffold's local package.json.
	@for dir in frontend e2e; do \
		if [ -f "private/examples/$(OUT)/$$dir/package.json" ]; then \
			printf "  \033[33m→\033[0m  Installing $$dir dev dependencies…\n"; \
			npm install --prefix "private/examples/$(OUT)/$$dir" --silent 2>/dev/null; \
		fi; \
	done
	@printf "\n  \033[32m✓\033[0m  Scaffolded → private/examples/$(OUT)\n"
	@printf "  \033[32m✓\033[0m  Local dude binary linked\n"
	@printf "  \033[36mℹ\033[0m  Run commands: \033[1mmake dev-run ARGS=\"lint\"\033[0m\n"
	@printf "  \033[36mℹ\033[0m  For HMR: keep \033[1mmake dev\033[0m running in a second terminal\n\n"

##@ Docs

.PHONY: docs
docs: ## Serve the project docs (docs/) with live-reload at http://localhost:8001
	@if ! docker info >/dev/null 2>&1; then \
		printf "  \033[31m✗\033[0m  Docker is not running. Start Docker Desktop and retry.\n"; \
		exit 1; \
	fi
	@printf "  \033[36mℹ\033[0m  Serving docs at \033[1mhttp://localhost:$(DOCS_PORT)\033[0m (Ctrl+C to stop)\n"
	docker run --rm -it -p $(DOCS_PORT):8000 -v "$(CURDIR)/docs":/docs \
		squidfunk/mkdocs-material serve --dev-addr=0.0.0.0:8000

##@ Quality

# ── Test layout ──────────────────────────────────────────────────────────────
# Tests are split by package, and each package mixes two kinds of test:
#   • unit          — pure functions / lint rules, run via vitest's TS transform
#   • integration   — scaffold a real project in a tmpdir and drive the actual
#                     `dude` binary (init, lint, …), exactly like a customer
# Integration tests spawn the built binary, so a fresh `dist/` is required; the
# `test*` targets depend on `build`, and turbo's `test` task also rebuilds.
#
# Fast local loop (HMR): no publish needed — `dude init --stack ./stacks/...`
# resolves the live workspace, and templates are read straight from source.
#   1. terminal A:  make dev                  # tsup --watch → keeps dist/ fresh
#   2. terminal B:  make test-watch-stack     # vitest --watch → reruns on change
#      or:          make dev-run ARGS="lint"  # one-shot run in the scaffold
# Editing a template re-runs scaffold tests instantly (templates are not built);
# editing TypeScript is picked up after `make dev` rebuilds dist/.

.PHONY: test
test: build ## Run every test suite (CLI runtime + stack)
	pnpm -r run test

.PHONY: test-cli
test-cli: build ## Test the dude CLI runtime package only (packages/dude)
	pnpm --filter @cubocicloide/dude run test

.PHONY: test-stack
test-stack: build ## Test the react-fastapi stack package only (stacks/react-fastapi)
	pnpm --filter @cubocicloide/stack-react-fastapi run test

.PHONY: test-watch
test-watch: build ## Watch + rerun all tests on change (pair with `make dev`)
	pnpm -r --parallel run test:watch

.PHONY: test-watch-cli
test-watch-cli: build ## Watch-test the CLI runtime package
	pnpm --filter @cubocicloide/dude run test:watch

.PHONY: test-watch-stack
test-watch-stack: build ## Watch-test the stack package
	pnpm --filter @cubocicloide/stack-react-fastapi run test:watch

.PHONY: test-install
test-install: ## Smoke-test the globally-installed binary end-to-end in Docker (mirrors CI)
	docker run --rm \
		-v "$(CURDIR):/dude-src:ro" \
		--env GITHUB_TOKEN="$${GITHUB_TOKEN}" \
		node:20 \
		bash -c 'set -e; mkdir -p /dude; \
			tar -C /dude-src --exclude=node_modules --exclude=dist --exclude=.git -cf - . | tar -C /dude -xf -; \
			bash /dude/scripts/test-global-install.sh /dude'

.PHONY: lint
lint: ## Lint all packages
	pnpm run lint

.PHONY: typecheck
typecheck: ## Type-check all packages
	pnpm run typecheck

.PHONY: format
format: ## Format the workspace with Prettier
	pnpm run format

.PHONY: format-check
format-check: ## Check formatting without writing changes
	pnpm run format:check

.PHONY: check
check: lint typecheck test ## Run lint + typecheck + tests (CI pre-flight)

##@ Release

.PHONY: changeset
changeset: ## Create a new changeset interactively
	pnpm run changeset

.PHONY: version
version: ## Apply pending changesets to package.json and CHANGELOGs
	pnpm run version-packages

.PHONY: release
release: ## Build and publish updated packages to GitHub Packages (emergency/manual only — CI handles normal releases)
	pnpm run release

# ── Release channels ─────────────────────────────────────────────────────────
# Every publish (CI or manual) lands on the `next` dist-tag: the candidate
# channel. `latest` (the stable channel — what `dude init` resolves by default)
# only moves when a maintainer explicitly promotes a verified version:
#
#   make promote PKG=stack-react-fastapi              # promote current `next`
#   make promote PKG=dude VERSION=0.13.0              # promote a specific version
#
# Promotion needs a token with the `write:packages` scope, picked up (in order)
# from GITHUB_TOKEN_ADMIN in .env, then GITHUB_TOKEN in the shell environment.

.PHONY: promote
promote: ## Promote a published version to stable — make promote PKG=<name> [VERSION=<x.y.z>]
	@if [ -z "$(PKG)" ]; then \
		printf "  \033[31m✗\033[0m  Usage: make promote PKG=<name> [VERSION=<x.y.z>]\n"; \
		printf "     e.g. make promote PKG=stack-react-fastapi\n"; \
		exit 1; \
	fi
	@export GITHUB_TOKEN="$${GITHUB_TOKEN_ADMIN:-$$GITHUB_TOKEN}"; \
	if [ -z "$$GITHUB_TOKEN" ]; then \
		printf "  \033[31m✗\033[0m  No token found — set GITHUB_TOKEN_ADMIN in .env or GITHUB_TOKEN in your shell (needs write:packages).\n"; \
		exit 1; \
	fi; \
	name="$(PKG)"; case "$$name" in @*) ;; *) name="@cubocicloide/$$name";; esac; \
	version="$(VERSION)"; \
	if [ -z "$$version" ]; then \
		version=$$(npm view "$$name" dist-tags.next 2>/dev/null); \
		if [ -z "$$version" ]; then \
			printf "  \033[31m✗\033[0m  %s has no \`next\` dist-tag to promote — pass VERSION=<x.y.z>\n" "$$name"; \
			exit 1; \
		fi; \
	fi; \
	current=$$(npm view "$$name" dist-tags.latest 2>/dev/null); \
	printf "  \033[33m→\033[0m  Promoting %s@%s to \`latest\` (currently: %s)\n" "$$name" "$$version" "$${current:-none}"; \
	npm dist-tag add "$$name@$$version" latest || { \
		printf "  \033[31m✗\033[0m  Promotion failed — does the token have write:packages?\n"; \
		exit 1; \
	}; \
	printf "  \033[32m✓\033[0m  Channels now:\n"; \
	npm dist-tag ls "$$name" | sed 's/^/     /'

.PHONY: dist-tags
dist-tags: ## Show release channels (dist-tags) of every publishable package
	@export GITHUB_TOKEN="$${GITHUB_TOKEN_ADMIN:-$$GITHUB_TOKEN}"; \
	for dir in packages/* stacks/*; do \
		name=$$(node -p "require('./$$dir/package.json').name" 2>/dev/null); \
		[ -n "$$name" ] || continue; \
		printf "\n  \033[1m%s\033[0m\n" "$$name"; \
		npm dist-tag ls "$$name" 2>/dev/null | sed 's/^/     /' \
			|| printf "     (not published)\n"; \
	done; \
	printf "\n"
