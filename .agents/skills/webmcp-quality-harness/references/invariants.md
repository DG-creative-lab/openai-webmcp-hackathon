# Conversion Lab invariant ledger

Use these invariants as independent test claims. Update this ledger only when the product contract deliberately changes.

| ID | Invariant | Primary enforcement | Minimum evidence |
| --- | --- | --- | --- |
| AUTH-01 | Only a human merchant may approve a staged variant. | No approval WebMCP tool; merchant UI calls `approveVariant`. | Tool inventory assertion plus browser handoff. |
| AUTH-02 | Publication requires approval bound to the exact copy and evidence IDs. | Approval digest check in `publishVariant`. | Stale-approval and illegal-transition tests. |
| AUTH-03 | An agent cannot reset the merchant workspace. | Reset exists only in the visible merchant UI. | Tool inventory assertion. |
| EVID-01 | Buyer-intent matches require verified evidence and matching supported terms. | `evaluateCopy` and `search_product_by_need`. | Verified/unverified and unsupported-need tests. |
| EVID-02 | Shopper matching requires verified evidence represented in the current visible copy; verified but hidden facts remain a no-match. | `search_product_by_need` evaluates representation coverage before matching the query. | Before/after publication adversarial comparison. |
| LIFE-01 | Legal progression is evaluated draft → staged → approved → published. | Store transition guards. | Decision-table adversarial tests. |
| STATE-01 | External callers cannot mutate the authoritative shared snapshot. | Recursively frozen store snapshots. | Mutation attempt test. |
| ADS-01 | Ads preparation uses the exact approved publication and remains a PAUSED projection. | Digest/status guard and fixed campaign status. | Precondition and zero-authority projection tests. |
| ADS-02 | The demo never calls an Ads API, activates a campaign, or spends money. | No external Ads adapter or activation capability exists. | Direct inspection plus projection disclaimer; this is not a live integration test. |
| CART-01 | Cart quantity stays between zero and inventory; checkout and payment never start. | Store normalization and narrow WebMCP result. | Boundary values plus browser journey. |
| RESET-01 | Merchant reset restores the canonical baseline while preserving browser WebMCP availability. | `initialState`-based reset. | Reset unit test. |

The product contract and independently observed user journey outrank implementation convenience. If a change makes an invariant obsolete, require an explicit product decision instead of silently weakening its test.
