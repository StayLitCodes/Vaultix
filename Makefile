.DEFAULT_GOAL := help

COMPOSE := docker compose -f apps/backend/docker-compose.yml

.PHONY: help dev dev-backend dev-frontend test lint build db-up db-reset contract-test

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_.-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start backend and frontend development servers
	@$(MAKE) --jobs=2 dev-backend dev-frontend

dev-backend:
	npm --prefix apps/backend run start:dev

dev-frontend:
	npm --prefix apps/frontend run dev

test: ## Run backend, frontend, and mobile test suites
	npm --prefix apps/backend test -- --runInBand
	npm --prefix apps/frontend test -- --runInBand
	npm --prefix apps/mobile test -- --runInBand

lint: ## Run root, backend, frontend, and mobile linters
	npm run lint
	npm --prefix apps/backend run lint
	npm --prefix apps/frontend run lint
	npm --prefix apps/mobile run lint

build: ## Build backend and frontend applications
	npm --prefix apps/backend run build
	npm --prefix apps/frontend run build

db-up: ## Start the local PostgreSQL container
	$(COMPOSE) up -d postgres

db-reset: ## Delete the local PostgreSQL volume and recreate the database
	$(COMPOSE) down --volumes && $(COMPOSE) up -d postgres

contract-test: ## Run Soroban contract tests
	cargo test --manifest-path apps/onchain/Cargo.toml