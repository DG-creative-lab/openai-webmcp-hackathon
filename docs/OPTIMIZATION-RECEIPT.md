# Portable optimisation receipt v1

`conversion-lab.optimization-receipt.v1` is the machine-readable handoff produced after one exact approved representation has both:

- a blocked Shopify Admin `productUpdate` preview; and
- a locally valid Google-compatible OpenAI Ads feed export with a `PAUSED`, £0-spend projection.

The public demo exposes the same deeply frozen receipt through the read-only `get_optimization_receipt` WebMCP tool and a local JSON download named `conversion-lab-optimization-receipt.json`.

The receipt is also the first portable boundary between the current reference host and future Conversion Lab delivery surfaces. A CLI, SDK, HTTP API, MCP server, Shopify host or agentic-commerce platform may transport or verify it under the same contract. Transport does not confer approval or execution authority.

## Contract map

| Section | Meaning |
| --- | --- |
| `assurance` | Supported approval policy, null demo principal, approval/expiry chronology, and explicit content-addressed, unsigned status |
| `target` / `productSnapshot` | Native Shopify identity and exact approved commercial fields |
| `representation` | Published copy, evidence IDs, approval digest and lifecycle times |
| `evidenceSet` | Complete versioned evidence, target identity, provenance, freshness, and numeric UTC min/max normalized to fixed-width ISO timestamps |
| `evaluation` | Reproducible baseline and optimized results for buyer-intent battery v1 |
| `channels.shopify` | API version, blocked update-preview state and approval payload digest |
| `channels.openaiAds` | Locally validated feed row, ad template, export digests, SFTP prerequisite and PAUSED/£0 state |
| `externalEffects` | Explicit false/zero declarations for writes, upload, activation, spend, checkout and payment |
| `receiptDigest` | `sha256-v1-` digest of the receipt body in recursively key-sorted canonical JSON |

## Verification

1. Remove only the top-level `receiptDigest` field.
2. Serialize the remaining JSON recursively: arrays keep order; object keys are sorted lexicographically at every level; strings, booleans, finite numbers and `null` use JSON encoding.
3. Hash the UTF-8 bytes with SHA-256 and prefix the lowercase hexadecimal result with `sha256-v1-`.
4. Compare the result to `receiptDigest`.
5. Independently enforce the semantic contract before operational use: supported version, target ownership, evidence authority and chronology, approval policy and expiry, lifecycle, complete Ads caveats, channel mode and zero-effect declarations.

The repository implementation is `canonicalOptimizationReceiptJson()` plus `verifyOptimizationReceiptDigest()` in `src/commerce/optimizationReceipt.ts`. Creation also independently recomputes the approval, buyer-intent evaluations, complete Shopify preview, Ads validation caveats and Ads export before issuing the receipt. Every evidence observation must predate approval, and any non-null approval expiry must remain current at issuance.

## Assurance boundary

This browser artifact is content-addressed, not cryptographically signed. Anyone can create a new body and digest, so a matching digest proves only that the downloaded body has not changed since that digest was calculated. It does not prove merchant identity, Shopify execution, OpenAI feed acceptance, Ads activation, spend or downstream ingestion. Receipt v1 accepts only `conversion-lab.demo-approval.v1` with `demo_ui_gesture` assurance and a null principal; authenticated merchant assurance is deliberately rejected until a production host can represent and verify it faithfully.

A production host should validate this v1 input and bind it to its authenticated tenant/workflow/representation-approval policy. Before any governed external effect, it must issue and revalidate a separate exact effect grant bound to the capability, channel, operation, native destination/account, target, approval/representation/projection digests, limits or budget, policy, expiry, revocation state and replay semantics. After execution it should issue its own signed, idempotent capability receipt. Conversion Lab should not inherit that host authority merely because this portable artifact exists.

The planned Stage 1.5 CLI may verify receipt integrity and semantic compatibility but must not convert a valid receipt into a Shopify write, Ads upload, activation, spend, checkout or payment. See [PLUGGABLE-ARCHITECTURE.md](PLUGGABLE-ARCHITECTURE.md) for the cross-surface authority model.
