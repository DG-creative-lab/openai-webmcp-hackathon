# OpenAI Ads feed-export contract snapshot

Observed: 2026-08-29  
Decision scope: Stage 1 OpenAI Ads product-feed export

## Official observations

- OpenAI accepts Google-compatible UTF-8 tab-delimited `.txt` or `.tsv` files and comma-delimited `.csv` files, with one header row and one product or variant per row.
- The Google-compatible core requires `id`, `title`, `description`, `link`, `image_link`, `availability`, `price`, and `brand`. Identifier and conditional availability-date rules also apply.
- Ads feeds use the stable base product schema and require `is_ads_eligible=true` for every product Ads should process.
- Initial feed connection and catalogue upload are completed through Ads Manager and its SFTP location. The public Advertiser API does not create the feed connection or upload the initial catalogue.
- Ads eligibility does not guarantee serving or even feed acceptance; the product and later campaign hierarchy remain subject to processing, review, funding, and activation state.

Sources:

- [OpenAI product-feed file specification](https://developers.openai.com/commerce/specs/file-upload/products)
- [OpenAI Ads product-feed guide](https://developers.openai.com/ads/product-feeds)

## Product inference and decision

Confidence: high for the documented file and onboarding contract; external acceptance remains unverified without an eligible Ads account and configured feed.

Conversion Lab will export a deterministic Google-compatible CSV from the same digest-approved representation used by the organic demo. The artifact records an independent file digest and the source approval digest. The browser may download it locally, but it will not upload by SFTP, create a feed connection, call the Advertiser API, activate a campaign, or claim acceptance.

This advances H1.3 without making account access a hackathon blocker. A server-side Ads adapter and live PAUSED hierarchy remain separate, credential-gated work.

## Acceptance-environment note

The 2026-08-29 Codex in-app browser available to this development task did not expose `document.modelContext`; the application therefore rendered its intentional `WebMCP-ready` fallback. This is not evidence that the ChatGPT challenge judge environment lacks WebMCP. The deterministic injected-host browser journey passes, but a clean ChatGPT browser session with a native WebMCP host remains required before feature freeze.
