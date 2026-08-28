# Conversion Lab — WebMCP commerce growth demo

Conversion Lab is a WebMCP-native growth workspace for commerce teams. It helps a merchant turn verified product facts into product copy that agents can reliably discover, evaluate and recommend—then projects that same approved truth into organic Shopify discovery and an OpenAI Ads product-feed package.

The demo merchant is the fictional urban-outdoor retailer **Fieldwork Supply**. Its hero product is a £159 modular waterproof commuter backpack/pannier.

## Why this exists

Most conversion optimisation assumes a person will scan a page and infer why a product fits. Buying agents work differently: they need explicit, structured, evidence-backed facts. A product can be ideal for a shopper and still lose the recommendation because its copy hides the facts that prove the match.

Conversion Lab makes that gap measurable. It:

1. Reads verified product, operations and policy evidence.
2. Generates an evidence-bound product variant.
3. Runs eight deterministic buyer-intent tasks.
4. Stages the result for a human merchant.
5. Hash-binds approval to the exact copy and evidence set.
6. Publishes only that approved version to the demo storefront.
7. Produces a compatible OpenAI Ads product-feed and **PAUSED** campaign projection.

## WebMCP site tools

The app registers nine page-scoped tools with `document.modelContext.registerTool`:

| Tool | Effect |
| --- | --- |
| `get_growth_workspace` | Reads product, evidence, evaluation and channel state |
| `audit_channel_readiness` | Explains organic and paid readiness gaps |
| `create_evidence_led_variant` | Creates a draft from verified evidence |
| `run_buyer_intent_battery` | Runs and stores eight deterministic evaluations |
| `stage_variant_for_merchant_review` | Stages a tested variant; cannot approve it |
| `publish_merchant_approved_variant` | Publishes only the exact hash-approved variant |
| `prepare_openai_ads_package` | Creates a feed row and PAUSED campaign projection |
| `search_product_by_need` | Matches a shopper need to verified facts |
| `update_demo_cart` | Updates visible demo cart state; never checks out |

Every input schema is narrow and rejects additional properties. Read-only tools declare `readOnlyHint`. Mutating tools describe their side effects and return enough state for the caller to verify the result.

## Authority model

- Agents may read evidence, draft, evaluate and stage.
- Only the visible merchant interface can create approval.
- Approval is bound to an FNV-1a digest of exact copy plus sorted evidence IDs.
- Publishing fails if approval is missing or stale.
- The Ads integration is deliberately a projection: no credential, external API write, activation or spend path exists in this demo.
- Cart tools cannot initiate checkout or payment.

## Run locally

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173` in a WebMCP-capable browser. The human interface remains fully functional in browsers without WebMCP support.

```bash
pnpm test
pnpm build
```

## Quality workflow

Create work on `feature/<short-name>` or `fix/<short-name>` branches. Use `make test-affected BASE_REF=origin/main` while iterating and `make test-all` before opening a pull request. Pull requests to `main` run the complete deterministic gate; branch pushes receive change-aware feedback.

The suite includes unit/contract coverage, bounded adversarial lifecycle and authority tests, and a Playwright agent-assisted browser journey. See [docs/TESTING.md](docs/TESTING.md) for the test map, CI policy, coverage scope and repo-local `$webmcp-quality-harness` skill.

Product delivery is organized across hackathon, standalone beta, platform-integration, and learning-growth stages in [docs/PRODUCT-ROADMAP.md](docs/PRODUCT-ROADMAP.md). The repo-local `$conversion-lab-product-steward` skill helps future Codex sessions select milestones, preserve cut lines, and validate material external changes before proposing roadmap shifts.

## Demo flow

1. Select **Reset demo** and confirm to start from the verified baseline.
2. In **Growth studio**, run the buyer-intent battery.
3. Stage the tested variant.
4. Approve the exact variant in the human UI.
5. Publish it to the demo storefront.
6. Prepare the paid projection.
7. Switch to **Shopper view** and see the same approved copy.
8. Ask Codex to inspect the growth workspace, search for a rainproof 16-inch laptop bag, or update the demo cart through the site tools.

The reset control is deliberately merchant-only and is not exposed as a WebMCP tool. It clears evaluation, approval, channel projections, cart state and prior activity while preserving the verified product evidence and the browser's WebMCP registration.

## Product boundaries

This first slice uses a deterministic, local evidence and evaluation engine so judges can verify the product without Shopify or Ads credentials. The production extension points are clear: Shopify Admin API ingestion/publication, OpenAI Ads campaign management and Delta Feed updates after merchant onboarding, measurement events, and a configurable intent-evaluation library.

The OpenAI Ads projection follows the documented product-feed shape and marks the item Ads-eligible. Initial feed connection and catalogue upload currently happen through Ads Manager and SFTP rather than the public Advertiser API. For eligible accounts with a linked feed, the API can then manage product-feed campaigns and Delta Feed updates. The credential-free demo therefore exports a validated package and PAUSED projection rather than pretending to provision a live feed or activate spend.

## References

- [OpenAI WebMCP site tools](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI Ads API overview](https://developers.openai.com/ads/api-overview)
- [OpenAI Ads product feeds](https://developers.openai.com/ads/product-feeds)
- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
