# Conversion Lab invariant ledger

Use these invariants as independent test claims. Update this ledger only when the product contract deliberately changes.

| ID | Invariant | Primary enforcement | Minimum evidence |
| --- | --- | --- | --- |
| AUTH-01 | Approval state is absent from the WebMCP site-tool surface, and the credential-free UI gesture is never presented as authenticated human authority. | Tool inventory plus explicit effect/UI assurance labels. | Inventory assertion, browser copy, and activity provenance test. |
| AUTH-02 | Publication requires approval bound to the exact native product target, copy, evidence set and evidence provenance. | Approval envelope and independently recomputed versioned SHA-256 digest in `publishVariant` and the Shopify adapter boundary. | Known FNV collision pair, cross-product, changed-copy, changed-provenance, concurrent-state-change, stale-approval and illegal-transition tests. |
| AUTH-03 | No WebMCP site tool can reset the workspace; ordinary browser automation remains possible in this unauthenticated demo. | Reset is absent from the registered tool inventory. | Tool inventory assertion plus honest product-boundary copy. |
| EVID-01 | Every material shopper constraint must be independently supported; any contradiction or unknown makes overall fit false. | `evaluateShopperNeed` and `search_product_by_need`. | Size, budget, negation, unknown-feature and mixed-constraint decision table. |
| EVID-02 | Shopper matching requires verified evidence represented in the current visible copy; verified but hidden facts remain a no-match. | `search_product_by_need` evaluates representation coverage before matching the query. | Before/after publication adversarial comparison. |
| EVID-03 | Version, native product identity, valid observation time and an allowed freshness discriminator survive ingestion into operational state and remain visible to WebMCP consumers. | `EvidenceRecord` is retained through `AppState`; evaluators and adapter validation reject wrong-product, missing-freshness and invalid-timestamp evidence. | Store and WebMCP contract assertions plus wrong-product, missing-freshness and impossible-date counterexamples. |
| LIFE-01 | Legal progression is evaluated draft → staged → approved → published. | Store transition guards. | Decision-table adversarial tests. |
| STATE-01 | External callers cannot mutate the authoritative shared snapshot. | Recursively frozen store snapshots. | Mutation attempt test. |
| ADS-01 | Ads preparation uses the exact approved publication, passes the bounded local feed-schema validator, emits a deterministic digest-bound Google-compatible CSV, and remains a PAUSED projection. | Digest/status guard, feed validator, fixed-column serializer, file/source digests and fixed campaign status. | Precondition, independent invalid-row oracle, CSV escaping and determinism tests, browser download, produced-row validation and zero-authority tests. |
| ADS-02 | The demo never uploads a feed by SFTP, calls an Ads API, activates a campaign, or spends money. | No SFTP, external Ads adapter or activation capability exists. | Direct inspection plus export/projection disclaimer; this is not a live integration test. |
| CART-01 | Cart quantity stays between zero and inventory; checkout and payment never start. | Store normalization and narrow WebMCP result. | Boundary values plus browser journey. |
| RESET-01 | Browser-UI reset restores the canonical baseline while preserving browser WebMCP availability. | `initialState`-based reset. | Reset unit test. |

The product contract and independently observed user journey outrank implementation convenience. If a change makes an invariant obsolete, require an explicit product decision instead of silently weakening its test.
