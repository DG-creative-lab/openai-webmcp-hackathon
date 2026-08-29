.PHONY: help install verify-diff check build test test-unit test-adversarial test-infrastructure test-coverage test-smoke test-fast test-all test-affected shopify-read ci

BASE_REF ?= origin/main

help:
	@echo "Conversion Lab quality harness"
	@echo ""
	@echo "Fast feedback:"
	@echo "  make test-unit          Unit and narrow contract tests"
	@echo "  make test-adversarial   Authority, lifecycle and failure-boundary tests"
	@echo "  make test-infrastructure Change-impact selector contract tests"
	@echo "  make test-fast          Typecheck plus unit tests"
	@echo ""
	@echo "System confidence:"
	@echo "  make test-smoke         Browser-level agent-assisted journey"
	@echo "  make test-coverage      Unit + adversarial suite with scoped thresholds"
	@echo "  make test-all           Complete merge gate"
	@echo "  make test-affected      Select tests from changes vs BASE_REF=$(BASE_REF)"
	@echo "  make shopify-read       Read one configured Shopify dev-store product (no write)"

install:
	pnpm install --frozen-lockfile

verify-diff:
	git diff --check

check:
	pnpm check

build:
	pnpm build

test: test-unit test-adversarial test-infrastructure

test-unit:
	pnpm test:unit

test-adversarial:
	pnpm test:adversarial

test-infrastructure:
	pnpm test:infrastructure

test-coverage:
	pnpm test:coverage

test-smoke:
	pnpm test:smoke

test-fast: verify-diff check test-unit test-infrastructure

test-all: verify-diff check test-infrastructure test-coverage build test-smoke

test-affected:
	node scripts/test-affected.mjs --base "$(BASE_REF)"

shopify-read:
	pnpm shopify:read

ci: test-all
