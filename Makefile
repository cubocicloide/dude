# dude — monorepo Makefile
# Self-documenting: run `make` or `make help` to list available targets.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Pass extra args to the local CLI: `make cli ARGS="init --stack react-fastapi"`
ARGS  ?=

# Local scaffold test — override with: make dev-init STACK=react-fastapi OUT=test-local
STACK ?= react-fastapi
OUT   ?= test-local

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
dev: ## Run dev scripts in every package in parallel
	pnpm run dev

.PHONY: cli
cli: ## Run the local CLI — usage: make cli ARGS="init --stack react-fastapi"
	pnpm --filter @cubocicloide/dude exec dude $(ARGS)

.PHONY: dev-init
dev-init: ## Scaffold locally without publish — make dev-init [STACK=react-fastapi] [OUT=test-local]
	pnpm --filter @cubocicloide/stack-$(STACK) build
	node packages/dude/bin/dude.mjs init --stack ./stacks/$(STACK) private/examples/$(OUT)

##@ Quality

.PHONY: test
test: ## Run tests across all packages
	pnpm run test

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
release: ## Build and publish updated packages to GitHub Packages
	pnpm run release
