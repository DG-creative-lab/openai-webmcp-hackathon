# Portable optimisation receipt v1

`conversion-lab.optimization-receipt.v1` is the machine-readable handoff produced after one exact approved representation has both:

- a blocked Shopify Admin `productUpdate` preview; and
- a locally valid Google-compatible OpenAI Ads feed export with a `PAUSED`, £0-spend projection.

The public demo exposes the same deeply frozen receipt through the read-only `get_optimization_receipt` WebMCP tool and a local JSON download named `conversion-lab-optimization-receipt.json`.

## Contract map

| Section | Meaning |
| --- | --- |
| `assurance` | Approval class plus explicit content-addressed, unsigned status |
| `target` / `productSnapshot` | Native Shopify identity and exact approved commercial fields |
| `representation` | Published copy, evidence IDs, approval digest and lifecycle times |
| `evidenceSet` | Complete versioned evidence, target identity, provenance and freshness |
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
5. Independently enforce the semantic contract before operational use: supported version, target ownership, evidence authority, approval policy, lifecycle, channel mode and zero-effect declarations.

The repository implementation is `canonicalOptimizationReceiptJson()` plus `verifyOptimizationReceiptDigest()` in `src/commerce/optimizationReceipt.ts`. Creation also independently recomputes the approval, buyer-intent evaluations, complete Shopify preview and Ads export before issuing the receipt.

## Assurance boundary

This browser artifact is content-addressed, not cryptographically signed. Anyone can create a new body and digest, so a matching digest proves only that the downloaded body has not changed since that digest was calculated. It does not prove merchant identity, Shopify execution, OpenAI feed acceptance, Ads activation, spend or downstream ingestion.

A production host should validate this v1 input, bind it to its authenticated tenant/workflow/approval policy, then issue its own signed and idempotent capability receipt for any governed external effect. Conversion Lab should not inherit that host authority merely because this portable artifact exists.
