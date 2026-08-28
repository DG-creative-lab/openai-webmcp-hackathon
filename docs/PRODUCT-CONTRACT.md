# Product contract — first submission slice

## Promise

For a Shopify merchant, turn verified product truth into measurable agent-selection readiness and reuse the approved result across organic WebMCP discovery and paid OpenAI Ads preparation.

## Demo outcome

A judge can watch a generic listing move from 0/8 to 8/8 deterministic buyer-intent coverage, review the supporting evidence, approve the exact variant, publish it to the shopper view, and prepare a paused Ads projection. The same actions are available to an agent through WebMCP, except the merchant-only approval.

## Non-negotiable invariants

1. No product claim without a verified evidence record.
2. No publication without explicit human approval of the exact variant digest.
3. No paid campaign activation or spend.
4. Every agent action changes the same state the merchant sees.
5. Every important effect produces a visible activity event.
6. The app remains useful when WebMCP is unavailable.
7. Only the visible merchant interface may reset the demonstration workspace.
8. Shopper matching requires verified evidence represented in the current visible copy; hidden merchant evidence is not discoverability.

## Current adapters

- **Shopify:** faithful local projection of product/catalogue and storefront state.
- **WebMCP:** live page-scoped tools registered through `document.modelContext`.
- **OpenAI Ads:** product-feed row and paused campaign projection based on the same approved product truth.
- **Codex:** agent operator that can discover and invoke the page's site tools while the merchant watches the same workspace.

## Intentionally deferred

- Shopify OAuth and live Admin API writes.
- Ads account credentials, initial feed onboarding, Delta Feed submission and campaign APIs.
- Model-based graders and production experimentation statistics.
- Multi-product catalogue ingestion.
- Merchant tenancy, persistence and audit export.
