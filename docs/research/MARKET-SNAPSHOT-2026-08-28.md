# Market and platform snapshot — 2026-08-28

Purpose: preserve the external evidence used to position Conversion Lab and sequence its roadmap. First-party growth figures are directional vendor claims unless independently verified.

## Challenge constraint

Observed:

- The WebMCP Challenge submission deadline is September 3, 2026 at 1:00 p.m. PDT.
- A submission needs a working live URL, a public code repository with source, assets, instructions and a visible open-source license, explanatory text, and a public video under three minutes with audio.
- Judging emphasizes WebMCP leverage, coherent execution, credible specific impact, and creativity/ambition.

Sources:

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Devpost challenge requirements](https://webmcp.devpost.com/)

Product implication: deployment, a clean judge journey, and submission materials belong inside the MVP cut line. Live integrations that threaten those deliverables are optional demonstrations, not dependencies.

## Shopify platform state

Observed:

- Shopify documents built-in WebMCP catalog, cart, and navigation tools for Liquid storefronts and the Hydrogen developer preview.
- Shopify’s Agentic Storefronts and Catalog increasingly distribute structured product data across AI shopping surfaces.
- Shopify’s 2026 developer platform includes public Catalog/UCP paths for developers, reducing the value of a product whose only promise is “make Shopify agent-accessible.”
- Shopify reports rapid growth and higher conversion from AI-originated shopping traffic. Treat the exact figures as first-party directional evidence until independently validated.
- Admin GraphQL `productUpdate` requires `write_products` scope and an authorized user, making exact merchant authorization and rollback central to a real publishing adapter.

Sources:

- [Shopify WebMCP tools](https://shopify.dev/docs/api/web-mcp)
- [Shopify Spring ’26 developer edition](https://www.shopify.com/news/spring-26-edition-dev)
- [Shopify Agentic Storefronts](https://www.shopify.com/news/agentic-commerce-momentum)
- [Shopify Admin GraphQL productUpdate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productUpdate)

Product implication: Conversion Lab should optimize the quality, evidence, and measured selection-readiness of merchant product representations. It complements Shopify’s distribution and transaction infrastructure rather than duplicating it.

## OpenAI Ads platform state

Observed:

- The OpenAI Advertiser API manages campaigns, ad groups, ads, files, insights, audiences, and product-feed campaigns.
- API keys are scoped to one ad account.
- An ad can show only when the ad, ad group, and campaign are enabled and the ad has passed review.
- Initial product-feed connection is configured in Ads Manager and the initial catalogue is uploaded by SFTP; the public API does not create or list feed connections or upload that initial catalogue.
- Once a feed is linked, the API exposes product-feed campaigns and Delta Feed updates, alongside campaign targeting, conversion-optimized campaign, and insights capabilities.
- Some programmatic operations depend on account enablement or partner access.

Sources:

- [OpenAI Advertiser API overview](https://developers.openai.com/ads/api-overview)
- [OpenAI Ads Product Feeds](https://developers.openai.com/ads/product-feeds)
- [OpenAI Ads Delta Feeds](https://developers.openai.com/ads/delta-feeds)

Product implication: a real integration is technically plausible, but credential and account availability must be treated as an explicit capability state. The hackathon demonstration should default to a validated PAUSED projection and never confuse it with live activation.

## Integration target state

Observed from the local refactor repository and its 2026-08-25 system map:

- The target platform combines a commerce optimisation/evidence-learning engine with a governed agent execution control plane.
- It already has an external-agent façade, registry, idempotent jobs, policy/harness posture, receipts, evidence, experimentation, validation, belief, and memory concepts.
- Its current safe envelope is sequential, supervised or low-risk work; exact approval envelopes and broader durable workflow capability are actively being developed.
- The intended embedded integration boundary is the external-agent job façade, not internal repositories or executors.

Sources:

- [Public integration-target repository](https://github.com/ai-knowledge-hub/deep-dive-analysis-agentic-commerce-augmentation)
- Local architecture baseline: `docs/research/current-platform-whole-system-map-v1.md` in that repository.

Product implication: mature Conversion Lab independently around stable domain contracts, then integrate it as a bounded capability pack after the target platform’s approval/workflow contracts stabilize.

## Current falsifiable positioning

Hypothesis:

> Shopify merchants and commerce agencies need an evidence-led optimisation layer that tells them why agents do or do not select products, safely improves the underlying representation, and connects one approved truth to organic and paid agent channels.

Evidence that would weaken or falsify it:

- Merchants consistently report that Shopify’s native Agentic dashboard already diagnoses and fixes the same evidence/readiness problem.
- Product representation quality shows no meaningful relationship to agent recommendation or conversion outcomes.
- Agencies will not connect catalogues, provide product evidence, or pay for this job.
- Platform policies prevent access to the product or outcome signals needed to measure value.

Next evidence required:

- Merchant and agency interviews.
- Comparison against native Shopify Agentic workflows.
- Real catalogue audit results.
- Observed recommendation, referral, cart, and conversion signals.
- Pricing and buyer-ownership evidence.
