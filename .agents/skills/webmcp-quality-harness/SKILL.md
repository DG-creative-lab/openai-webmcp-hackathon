---
name: webmcp-quality-harness
description: Design, select, extend, run, or diagnose tests and CI for the Conversion Lab WebMCP commerce demo. Use for changes to product evidence, lifecycle state, merchant approval, WebMCP tools, storefront behavior, Ads projections, carts, test coverage, or pull-request gates. Do not use for editorial-only copy changes unrelated to product behavior.
---

# WebMCP Quality Harness

Protect the demonstrable business outcome: an agent can discover and improve a product journey, verified merchant evidence remains authoritative, digest-bound demo approval is represented honestly, and no live paid activation occurs. The credential-free UI checkpoint is not authenticated human authority.

## Establish the change surface

1. Read `docs/PRODUCT-CONTRACT.md` and `docs/TESTING.md`.
2. Inspect the changed paths and trace their reachable readers, writers, tools, UI surfaces, and channel projections.
3. For lifecycle, WebMCP, Ads, cart, or evidence changes, read [references/invariants.md](references/invariants.md) before selecting tests.
4. Preserve unrelated work and report any evidence gap that prevents a consequential invariant from being tested.

## Select the smallest useful portfolio

- Use unit tests for pure evaluation, hashes, normalization, schemas, and narrow store behavior.
- Use adversarial tests for authority, illegal transitions, stale approvals, unverified evidence, unsupported needs, mutation attempts, and prohibited effects.
- Use the Playwright smoke journey when a change can affect tool discovery, shared browser state, the visible approval checkpoint, published shopper copy, Ads projection, or the cart.
- Add an independent expected-state table or contract assertion when production logic would otherwise become its own oracle.

Start iteration with `make test-affected BASE_REF=origin/main`. Run the focused target while editing. Before proposing a PR, run `make test-all`.

## Keep authority deterministic

The skill may interpret a change, propose scenarios, add tests, and explain failures. It does not decide whether CI passes, weaken thresholds to make a change green, or authorize Shopify, checkout, payment, Ads API, campaign activation, or spend. A test-internal click may advance synthetic lifecycle state but must never be described as authenticated approval.

Make targets, schemas, state guards, browser assertions, and GitHub Actions are the executable authority. CI must remain deterministic and runnable without an OpenAI API key or an agent invocation.

When a test fails, determine whether it exposes a product defect, a stale test oracle, an environmental failure, or an intentionally changed contract. Do not automatically rewrite the expectation to match the implementation.

## Report evidence

State which test layers ran, the affected invariants, observed pass/fail counts, scoped coverage results, and any untested external behavior. Never describe a PAUSED demo projection as proof of a live OpenAI Ads integration.
