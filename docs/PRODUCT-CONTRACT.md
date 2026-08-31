# Product contract — first submission slice

## Promise

For a Shopify merchant, turn verified product truth into measurable agent-selection readiness and reuse the approved result across organic WebMCP discovery and paid OpenAI Ads preparation.

## Product form

Conversion Lab is the optimisation layer, not the reference website itself. The current hackathon host combines the layer, merchant workspace, fictional storefront and WebMCP adapter in one browser application. The accepted evolution is one headless core consumed by web, Shopify, SDK, CLI, API, MCP and agentic-platform adapters under the same versioned evidence and authority contracts.

That separation is not yet implemented. Until the Stage 1.5 portability proof lands, the repository must describe the web application as a reference host and the SDK/CLI/API/MCP forms as planned surfaces. The canonical design is [PLUGGABLE-ARCHITECTURE.md](PLUGGABLE-ARCHITECTURE.md).

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
9. A portable receipt exists only after pre-approval evidence, a supported current approval policy, the exact approved publication, complete local Ads caveats, blocked Shopify update preview, locally valid Ads export and PAUSED projection agree. It carries approval policy/expiry context, is content-addressed and explicitly unsigned, and never implies that an external effect occurred.
10. Every future delivery surface must preserve the same target identity, evidence, lifecycle, approval, exact effect grant, durable replay-ledger ownership, outcome lineage and receipt semantics; a CLI, API, MCP or SDK wrapper cannot broaden authority, reuse approval across channels, concurrently consume one grant, or silently reinterpret partial success and unresolved attribution.

## Current adapters

- **Shopify:** faithful local projection of product/catalogue and storefront state.
- **WebMCP:** live page-scoped tools registered through `document.modelContext`.
- **OpenAI Ads:** digest-bound Google-compatible CSV feed export and paused campaign projection based on the same approved product truth.
- **Codex:** agent operator that can discover and invoke the page's site tools while the merchant watches the same workspace.
- **Portable receipt:** versioned JSON bridge carrying complete evidence, before/after intent results, approval binding and honest channel-effect declarations for downstream inspection.

## Planned host ports

- **Catalogue source:** supplies provider-native product identity and provenance-bearing evidence.
- **Workspace repository:** owns persistence and stale-write protection for one workspace instance.
- **Clock:** supplies deterministic validation and issuance time.
- **Approval authority:** attests an exact representation decision; it does not authorize a channel effect by itself.
- **Effect authority:** supplies a host-attested grant bound to capability, channel, operation, destination/account, target, approval/representation/projection digests, limits/budget, policy, expiry, revocation and replay semantics.
- **Replay ledger:** durably owns `issued → claimed → succeeded|failed|ambiguous` transitions using atomic compare-and-set, leases and fencing; ambiguous outcomes block retry until provider reconciliation.
- **Channel projector/executor:** separates credential-free previews from governed effects; only the current replay-ledger claim owner may revalidate and execute the exact grant.
- **Receipt sink/outcome observer:** transports evidence without turning it into permission and binds observations to tenant/product, channel/account, representation, projection/effect receipt, native IDs and a bounded window; unresolved attribution remains partial or unknown.

## Intentionally deferred

- Shopify OAuth and live Admin API writes.
- Ads account credentials, initial feed onboarding, Delta Feed submission and campaign APIs.
- Model-based graders and production experimentation statistics.
- Multi-product catalogue ingestion.
- Merchant tenancy, persistence and audit export.
- Authenticated merchant identity and a live-execution approval grant with enforceable policy and expiry.
- Public SDK or API stability, CLI distribution, MCP server operation, and non-Shopify provider completeness.
