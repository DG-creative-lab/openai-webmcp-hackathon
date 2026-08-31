# Conversion Lab submission pack

Status: repository-ready draft; external acceptance items are tracked in [`submission-manifest.json`](submission-manifest.json).

## Submission identity

**Product:** Conversion Lab  
**Tagline:** A pluggable agent-conversion optimisation layer for organic and paid commerce discovery.
**Live demo:** https://conversion-lab-webmcp.vercel.app/  
**Source:** https://github.com/DG-creative-lab/openai-webmcp-hackathon  
**License:** MIT

## Devpost-ready description

Commerce teams optimise product pages for people, but buying agents need something more explicit: facts they can discover, verify, and connect to a shopper's constraints. A suitable product can lose the recommendation simply because its generic copy hides the evidence that proves the fit.

Conversion Lab is a pluggable agent-conversion optimisation layer for commerce, demonstrated through a WebMCP-native reference workspace. In one visible browser session, an agent inspects eight merchant-controlled product facts, measures the current listing against eight buyer intents, creates an evidence-bound representation, and stages it for review. The browser user can record exact digest-bound demo approval; approval and reset are deliberately absent from the WebMCP site-tool surface. After approval, the agent publishes the same representation to the demo storefront, prepares a locally validated OpenAI Ads product-feed CSV and PAUSED paid projection, exports a content-addressed optimisation receipt, verifies a shopper need constraint by constraint, and updates the shared cart without entering checkout.

The product demonstrates how WebMCP can become a growth surface rather than a thin automation layer. Ten page-scoped tools let the agent reason over the same product, evidence, lifecycle, paid projection, portable receipt, and cart state that the merchant sees. Deterministic controls preserve product identity, evidence provenance, exact approval, lifecycle legality, and zero-spend boundaries while leaving the agent free to inspect, propose, test, and explain.

The public experience is credential-free and repeatable. It uses a deterministic Fieldwork Supply fixture, a versioned Shopify Admin read/update-preview adapter contract, and a digest-bound Google-compatible Ads feed export. It does not claim a live Shopify write, OpenAI feed acceptance, SFTP delivery, Ads API activation, campaign spend, authenticated merchant identity, checkout, payment, or measured commercial lift.

The current website is the first reference host, not yet an installable merchant integration. The product architecture defines one future headless core with web, Shopify, SDK/API, CLI, MCP, WebMCP and agentic-platform adapters. Until the bounded portability proof is implemented and tested, the submission must not claim that those additional delivery surfaces ship in the public build.

## Judging-criteria map

| Criterion | Evidence in the demo |
| --- | --- |
| WebMCP leverage | Ten discoverable site tools form one stateful audit → draft → evaluation → review → publication → paid projection → portable proof → shopper journey. |
| Execution | Public Vercel app, narrow schemas, effect metadata, digest-bound approval, deterministic tests, downloadable CSV and JSON receipt, visible shared cart, and graceful non-WebMCP fallback. |
| Specific impact | Moves a generic listing from 0/8 to 8/8 verifiable buyer-intent coverage and reuses one approved truth across organic and paid preparation. |
| Creativity | Treats agent discoverability as a conversion discipline, connecting merchant evidence, agent selection, channel consistency, and paid relevance without inventing claims. |

If the Stage 1.5 proof lands before feature freeze, the execution and impact evidence may additionally state that the reference website and CLI/SDK consume the same versioned optimisation core. Do not add that claim based on architecture documentation alone.

## What is real, projected, and deferred

| Surface | Demonstrated now | Not claimed |
| --- | --- | --- |
| WebMCP | Page-scoped tools operating the visible shared workspace | WebMCP availability in every browser host |
| Approval | Versioned SHA-256 binding over target, commercial snapshot, copy, evidence, tags, and provenance | Authenticated merchant identity or enforced human-only action |
| Shopify | Version-pinned read adapter, native product identity, credential-free update preview | Live `productUpdate`, OAuth onboarding, or rollback execution |
| OpenAI Ads | Locally validated product-feed row, deterministic CSV, PAUSED projection, £0 spend | Feed acceptance, SFTP upload, Ads API write, activation, or delivery |
| Receipt | Versioned, content-addressed local JSON over the approved evidence, evaluation and projections | Cryptographic signature, external effect receipt, persistence, or downstream acceptance |
| Shopper | Constraint-level verified match and visible bounded cart | Checkout, payment, or observed conversion lift |

## 165-second video storyboard

The public video must include audio and remain below the three-minute limit. Target duration: **2:45**.

| Time | Visual | Narration purpose |
| --- | --- | --- |
| 0:00–0:15 | Generic 0/8 listing and product evidence | Establish the growth problem: the product fits, but agents cannot verify why. |
| 0:15–0:35 | Ask the starter prompt; agent discovers the workspace | Show WebMCP as the interaction layer, not a hidden backend script. |
| 0:35–0:58 | Draft becomes 8/8 with evidence trace | Demonstrate measurable improvement without invented claims. |
| 0:58–1:18 | Stage and stop at the orange review checkpoint | Make the authority boundary visible; the agent has no approval tool. |
| 1:18–1:36 | Browser user records exact demo approval | Explain digest binding and the credential-free limitation in one sentence. |
| 1:36–1:58 | Agent publishes the approved demo copy | Show the same approved representation in the shopper-facing view. |
| 1:58–2:18 | Prepare PAUSED Ads projection; reveal CSV and portable receipt | Connect organic and paid relevance, then show the reusable proof artifact with £0 spend. |
| 2:18–2:35 | Search waterproof 16-inch laptop need | Show constraint-level evidence and truthful overall fit. |
| 2:35–2:45 | Update cart to two and reveal completed guide | Close on shared state and the business outcome; no checkout or payment. |

## Capture list

1. Baseline 0/8 workspace with verified evidence visible.
2. WebMCP tool discovery or agent invocation in the ChatGPT browser.
3. 8/8 evaluated representation with evidence trace.
4. Visible approval checkpoint showing that approval is outside site tools.
5. Digest-bound Shopify preview and PAUSED Ads projection.
6. Downloaded CSV and unsigned optimisation-receipt JSON plus local validation limits.
7. Constraint-supported shopper match and cart quantity two.
8. Final six-of-six journey state and public URL.

## Final external checklist

- [ ] Run the complete journey in a clean WebMCP-enabled ChatGPT browser session.
- [ ] Repeat the public journey from a second clean session, machine, or account when possible.
- [ ] Record, edit, and publish the 2:45 video with audible narration.
- [ ] Add the public video URL to `submission-manifest.json` and mark its evidence passed.
- [x] Confirmed the production Vercel URL and completed the scripted deployment journey 1/1 on 2026-08-29; this used the injected test host and is not native ChatGPT WebMCP acceptance.
- [ ] Paste and proof the Devpost description, links, technologies, and team details.
- [ ] Capture fallback screenshots and a short backup recording.
- [ ] Submit before the deadline and record the confirmation URL or receipt.

Passing repository CI does not complete these external items. Their status must be backed by an actual URL, dated run, or submission receipt in the manifest.
