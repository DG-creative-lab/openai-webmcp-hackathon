# Conversion Lab — WebMCP commerce growth demo

Conversion Lab is a WebMCP-native growth workspace for commerce teams. It helps a merchant turn verified product facts into product copy that agents can reliably discover, evaluate and recommend—then projects that same approved truth into organic Shopify discovery and an OpenAI Ads product-feed package.

The demo merchant is the fictional urban-outdoor retailer **Fieldwork Supply**. Its hero product is a £159 modular waterproof commuter backpack/pannier.

## Why this exists

Most conversion optimisation assumes a person will scan a page and infer why a product fits. Buying agents work differently: they need explicit, structured, evidence-backed facts. A product can be ideal for a shopper and still lose the recommendation because its copy hides the facts that prove the match.

Conversion Lab makes that gap measurable. It:

1. Reads verified product, operations and policy evidence.
2. Generates an evidence-bound product variant.
3. Runs eight deterministic buyer-intent tasks.
4. Stages the result at a visible browser review checkpoint.
5. Binds the demo approval state with a versioned SHA-256 digest over the canonical product target, exact copy, complete evidence content, tags and provenance.
6. Publishes only that digest-approved version to the demo storefront.
7. Produces a locally schema-validated OpenAI Ads product-feed row and **PAUSED** campaign projection.

## WebMCP site tools

The app registers nine page-scoped tools with `document.modelContext.registerTool`:

| Tool | Effect |
| --- | --- |
| `get_growth_workspace` | Reads product, evidence, evaluation and channel state |
| `audit_channel_readiness` | Explains organic and paid readiness gaps |
| `create_evidence_led_variant` | Creates a draft from verified evidence |
| `run_buyer_intent_battery` | Runs and stores eight deterministic evaluations |
| `stage_variant_for_review` | Stages a tested variant; cannot approve it through site tools |
| `publish_approved_variant` | Publishes only the exact hash-approved demo variant |
| `prepare_openai_ads_package` | Creates a feed row and PAUSED campaign projection |
| `search_product_by_need` | Matches a shopper need to verified facts |
| `update_demo_cart` | Updates visible demo cart state; never checks out |

Every input schema is narrow and rejects additional properties. Read-only tools declare `readOnlyHint`. Every successful result identifies its effect class, authority, whether state or an external system changed, the current workspace snapshot, and the safest next action.

## Authority model

- Site tools may read evidence, draft, evaluate and stage; no approval or reset site tool is registered.
- The visible browser interface records the demo approval gesture in a deeply frozen envelope bound by a `sha256-v1` Web Crypto digest to the canonical Shopify product target, exact copy, complete runtime-validated evidence content, tags and provenance.
- This credential-free demo does not authenticate the browser actor and therefore does not claim enforced human or merchant-only authority. A production Shopify write requires an authenticated merchant grant bound to the same target and digest.
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

1. Select **Reset demo** and confirm to return to the generic 0/8 baseline.
2. In **Growth studio**, use the exact starter prompt shown in the six-checkpoint judge guide.
3. Let Codex inspect evidence, create and evaluate the 8/8 draft, and stage it for review.
4. At the orange review checkpoint, inspect and approve the exact variant in the visible UI. This is a transparent demo gesture, not an authenticated identity check.
5. Tell Codex to continue with the prompt shown by the guide. It publishes the approved demo copy, prepares the PAUSED paid projection, verifies the shopper match and updates the cart.
6. Switch to **Shopper view** and verify the same approved copy and cart state.

The reset control is deliberately absent from the WebMCP site-tool surface. It remains available in the page UI, so ordinary browser automation could still operate it. Reset clears evaluation, approval, channel projections, cart state and prior activity while preserving verified product evidence and the browser's WebMCP registration.

## Product boundaries

This first slice uses a deterministic, local evidence and evaluation engine so judges can verify the product without Shopify or Ads credentials. The production extension points are clear: Shopify Admin API ingestion/publication, OpenAI Ads campaign management and Delta Feed updates after merchant onboarding, measurement events, and a configurable intent-evaluation library.

The OpenAI Ads projection includes the documented core file-upload fields, marks the item Ads-eligible, and truthfully sets `identifier_exists` to `no` for this fictional product. An independent local validator checks required fields, identifier rules, URL syntax, price format and supported availability. It cannot prove URL reachability, merchant/feed configuration, or acceptance by OpenAI processing, and the UI reports those limits. Initial feed connection and catalogue upload happen through Ads Manager and SFTP rather than the public Advertiser API; the credential-free demo never pretends to provision a feed or activate spend.

## References

- [OpenAI WebMCP site tools](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI Ads API overview](https://developers.openai.com/ads/api-overview)
- [OpenAI Ads product feeds](https://developers.openai.com/ads/product-feeds)
- [OpenAI product-feed file specification](https://developers.openai.com/commerce/specs/file-upload/products)
- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
