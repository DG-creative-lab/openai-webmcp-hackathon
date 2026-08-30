# Product contract — first submission slice

## Promise

For a Shopify merchant, turn verified product truth into measurable agent-selection readiness and reuse the approved result across organic WebMCP discovery and paid OpenAI Ads preparation.

## Demo outcome

A judge can watch a generic listing move from 0/8 to 8/8 deterministic buyer-intent coverage, review the supporting evidence, record exact digest-bound demo approval, publish it to the shopper view, prepare a paused Ads projection, and export one portable optimisation receipt. Approval and reset are absent from the WebMCP site-tool surface. Because this slice has no authentication, ordinary browser automation can still operate the visible UI and the demo does not claim enforced human authority.

## Non-negotiable invariants

1. No product claim without a verified evidence record.
2. No demo publication without current approval state bound by a versioned SHA-256 digest to one owned snapshot of the exact product target, feed-bearing commercial fields with canonical GBP minor-unit precision, copy and runtime-validated provenance-bearing evidence; do not present the credential-free UI gesture as authenticated merchant authority.
3. No paid campaign activation or spend.
4. Every agent action changes the same state the merchant sees.
5. Every important effect produces a visible activity event.
6. The app remains useful when WebMCP is unavailable.
7. No WebMCP site tool may approve or reset the demonstration workspace; UI availability is not an authorization boundary.
8. Shopper matching requires verified evidence represented in the current visible copy; hidden merchant evidence is not discoverability.
9. A portable receipt exists only after the exact approved publication, blocked Shopify update preview, locally valid Ads export and PAUSED projection agree. It is content-addressed and explicitly unsigned; it never implies that an external effect occurred.

## Current adapters

- **Shopify:** faithful local projection of product/catalogue and storefront state.
- **WebMCP:** live page-scoped tools registered through `document.modelContext`.
- **OpenAI Ads:** digest-bound Google-compatible CSV feed export and paused campaign projection based on the same approved product truth.
- **Codex:** agent operator that can discover and invoke the page's site tools while the merchant watches the same workspace.
- **Portable receipt:** versioned JSON bridge carrying complete evidence, before/after intent results, approval binding and honest channel-effect declarations for downstream inspection.

## Intentionally deferred

- Shopify OAuth and live Admin API writes.
- Ads account credentials, initial feed onboarding, Delta Feed submission and campaign APIs.
- Model-based graders and production experimentation statistics.
- Multi-product catalogue ingestion.
- Merchant tenancy, persistence and audit export.
- Authenticated merchant identity and a live-execution approval grant with enforceable policy and expiry.
