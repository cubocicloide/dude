SHELL := /bin/bash
.DEFAULT_GOAL := help

service ?=

.PHONY: help up down build logs shell lint

help: ## Show available targets
	@printf "\nAvailable targets:\n\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\n"

##@ Docker

up: ## Start all services in background
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Build and start all services
	docker compose up --build

logs: ## Follow service logs (usage: make logs service=backend)
	docker compose logs -f $(service)

shell: ## Open a shell in a service (usage: make shell service=backend)
	docker compose exec $(service) /bin/bash || docker compose exec $(service) /bin/sh

##@ Quality

lint: ## Check project structure conventions (FE001-FE007, BE001-BE004)
	dude lint .
