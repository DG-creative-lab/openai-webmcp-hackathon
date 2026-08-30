# Conversion Lab product roadmap

Status: active product and delivery baseline  
Date: 2026-08-28  
Current horizon: Stage 1 — WebMCP Challenge MVP

## Product decision

Conversion Lab is an **agent conversion readiness and optimisation layer for commerce**.

It helps a merchant answer and improve one commercially important question:

> When a buyer asks an agent for a product like mine, can the agent find the right product, verify why it fits, and carry the same approved truth into organic and paid acquisition?

The product is not a generic WebMCP installer. Shopify already supplies catalog, cart, and navigation WebMCP tools on Liquid storefronts and its Hydrogen developer preview. Conversion Lab differentiates by measuring agent-selection readiness, finding evidence gaps, producing evidence-bound product representations, testing them against buyer intent, preserving exact merchant approval, and projecting the approved result across channels.

## Product outcome and boundaries

The north-star outcome is **verified improvement in agent product selection and downstream conversion**, not the number of generated variants or successful tool calls.

The durable product loop is:

```text
authoritative product truth
  → buyer-intent and channel-readiness audit
  → evidence-bound representation candidate
  → deterministic and agent-assisted evaluation
  → exact merchant approval
  → bounded channel projection or publication
  → observed selection and conversion outcomes
  → next evidence-backed decision
```

Across every stage:

- The model may interpret demand, propose copy, select evidence, plan tests, and explain tradeoffs.
- Shopify, merchant systems, and verified source records attest product truth and identity.
- Deterministic code owns schemas, lifecycle guards, hashes, budgets, and test gates.
- The merchant owns approval for publication or paid effects.
- A successful simulation or synthetic score is never reported as observed commercial lift.
- Checkout, payment, or campaign activation requires a separate product and authority decision.

## Roadmap overview

| Stage | Product state | Primary customer evidence | Exit condition |
| --- | --- | --- | --- |
| 1. Hackathon MVP | Judge-ready WebMCP product proof | Complete human-agent journey and challenge criteria | Public app, repository, video, submission, and repeatable acceptance run before the deadline |
| 2. Standalone/pluggable beta | Useful merchant or agency workflow | Design partners use it on real catalogues and return observed value signals | Repeatable audit-to-approved-publication workflow for multiple products and merchants |
| 3. Agentic-commerce module | Governed capability pack inside the larger platform | Cross-system jobs produce typed results and receipts without bypassing authority | Versioned external-agent contract, golden fixtures, lifecycle proof, and end-to-end platform run |
| 4. Learning growth product | Evidence-led cross-channel optimisation system | Observed selection and conversion outcomes improve later decisions | Measured outcome loop, safe adaptation, provider expansion, and a validated commercial model |

## Stage 1 — WebMCP Challenge MVP

Target: submit before **September 3, 2026 at 1:00 p.m. PDT / 9:00 p.m. BST**. Internal submission freeze: September 2.

The MVP must demonstrate a coherent product experience, not a collection of integrations. A judge should understand the problem and complete the critical journey in under three minutes.

### Already delivered

- One evidence-led Shopify-style product workspace and shopper view.
- Ten page-scoped WebMCP tools sharing visible browser state.
- Deterministic 0/8 → 8/8 buyer-intent evaluation.
- Exact digest-bound visible demo approval state before publication, explicitly labeled as unauthenticated.
- Digest-bound, locally schema-validated Google-compatible OpenAI Ads CSV export and PAUSED campaign projection with external acceptance limits disclosed.
- Versioned commerce contracts, Shopify Admin 2026-07 update preview, and optional credential-contained dev-store product read.
- Stable public Vercel deployment with Git previews and repeatable production-output smoke coverage.
- Approval and reset absent from the WebMCP site-tool surface, plus a visible activity trail.
- Versioned, unsigned and content-addressed portable optimisation receipt spanning evidence, 0/8 → 8/8 evaluation, Shopify preview and PAUSED Ads projection.
- Unit, contract, adversarial, change-impact, coverage, build, and browser smoke gates.
- Branch-based pull-request workflow with a complete merge gate.

### H1.1 — Judge-ready core experience

Priority: must ship.

Deliverables:

- Tighten tool names, descriptions, schemas, results, and error recovery around the judge journey.
- Add explicit output contracts where the WebMCP implementation supports them.
- Make the tool/effect boundary legible in the interface: read, draft, stage, publish, cart, and paid projection.
- Add a concise in-product guided demo so a judge can start without prior context.
- Preserve useful non-WebMCP behavior and graceful unsupported-browser messaging.
- Run the native ChatGPT in-app-browser acceptance journey after every material WebMCP change.

Acceptance evidence:

- All tools are discovered with correct descriptions and narrow schemas.
- An agent can inspect evidence, create and test a variant, stage it, stop at the visible approval checkpoint, publish the exact digest-approved variant, recommend it to a shopper, and update the same visible cart.
- Approval and reset remain unavailable as WebMCP site tools. The credential-free demo does not claim to block ordinary browser automation; authenticated merchant grants are required before production Shopify or paid effects.
- `make test-all` and the native in-app-browser journey both pass from a clean reset.

### H1.2 — Integration spine and Shopify proof

Priority: must ship as a faithful adapter boundary; live dev-store proof is should ship.

Introduce versioned internal contracts for:

- `CommerceProduct`
- `EvidenceRecord`
- `RepresentationVariant`
- `EvaluationResult`
- `ApprovalEnvelope`
- `ChannelProjection`
- `EffectReceipt`

Implement two modes behind the same boundary:

1. **Credential-free judge mode** using the deterministic Fieldwork Supply fixture.
2. **Optional Shopify dev-store mode** that reads a configured demo product and, only after exact merchant approval, updates that controlled product through Shopify Admin GraphQL.

The Shopify adapter should:

- bind the store and native product ID before proposing an effect;
- read title, description, handle, price, inventory, images, and selected metafields;
- retain provenance and freshness for imported product facts;
- preview the exact `productUpdate` payload;
- require `write_products` and an authorized Shopify user for the controlled write;
- snapshot the prior representation and provide a tested rollback path;
- return Shopify user errors and a durable effect receipt without presenting partial success as completion;
- keep credentials server-side and entirely outside the public repository and browser bundle.

Exit condition: the public experience works without Shopify credentials, while a recorded or locally reproducible dev-store run proves the real adapter contract.

### H1.3 — OpenAI Ads proof

Priority: must ship as a validated projection; live PAUSED API proof is stretch.

Deliverables:

- Validate and export a product-feed package from the same exact approved representation used for organic discovery.
- Add a server-side Ads adapter boundary using one-ad-account credentials.
- Model initial feed connection and catalogue upload as an explicit Ads Manager/SFTP prerequisite; do not claim that the public Advertiser API creates the initial feed.
- Use the linked feed ID for product-feed campaigns and Delta Feed updates only after that prerequisite is satisfied.
- Support a dry-run/preview mode by default.
- If an eligible Ads account and API key are available, create or update only a PAUSED test campaign hierarchy and retain returned native IDs and review state.
- Revalidate approval, account, payload digest, and PAUSED target state immediately before any API write.
- Make live, projected, unsupported, and failed states visually distinct.
- Never expose a tool or UI path that enables a campaign or incurs spend during the hackathon demo.

Exit condition: feed and campaign payloads pass contract tests and appear in the visible workflow. Live API proof may strengthen the demo, but lack of account access must not block submission or be disguised as a live integration.

### H1.4 — Deployment and submission

Priority: must ship.

Status: in progress. The stable Vercel app, public repository, MIT license, setup instructions, Devpost-ready draft, 165-second storyboard, and executable submission manifest are present. Native WebMCP acceptance, second-session rehearsal, public narrated video, fallback capture, and Devpost confirmation remain external checkpoints and are not inferred from CI.

Deliverables:

- Deploy a stable public URL usable in ChatGPT’s in-app browser.
- Verify the public build from a clean browser session and a second machine/account when possible.
- Keep the public GitHub repository runnable with a visible open-source license and complete setup instructions.
- Produce a public video under three minutes with audio.
- Write the submission around the judging criteria: WebMCP leverage, execution, specific impact, and creativity.
- Capture a short fallback demo recording and screenshots in case the live environment fails during review.

Submission story:

1. A commercially suitable product is invisible to agents because its generic copy hides verified fit.
2. The agent reads merchant-controlled evidence and tests the current listing.
3. It creates and evaluates a better representation, while the WebMCP tool surface exposes no approval action.
4. A browser user reviews and records exact demo approval; production publication requires an authenticated merchant grant.
5. The agent publishes the approved truth, prepares a PAUSED paid projection, recommends the product, and updates the visible shopper cart.
6. The browser user sees every action; the demo distinguishes visible review state from production merchant authority.

### Stage 1 cut line

Must ship before any stretch work:

- Public URL and clean-session reliability.
- Native WebMCP discovery and shared-state journey.
- Honest digest-bound demo approval state, with authenticated merchant authority reserved for the real adapter boundary.
- Faithful Shopify and Ads adapter contracts with credential-free fallback.
- Submission copy, repository instructions, license visibility, and video.

Stretch only after the cut line is green:

- Live Shopify dev-store write and rollback proof.
- Live OpenAI Ads PAUSED object creation.
- Additional products, personas, visual polish, or model-based graders.

Deferred from the hackathon:

- Production OAuth onboarding, multi-tenant persistence, billing, bulk catalogues, live campaign activation, autonomous budget decisions, checkout, payment, and statistically valid commercial lift claims.

### Delivery calendar

| Date | Delivery focus | Required proof |
| --- | --- | --- |
| Aug 28 | Ratify roadmap, product contracts, and delivery skill | Roadmap and skill reviewed; next branch selected |
| Aug 29 | WebMCP contract polish and guided judge journey | Native browser acceptance plus complete gate |
| Aug 30 | Adapter spine and Shopify read/preview path | Fixture and dev-store contract tests; no credential leakage |
| Aug 31 | Shopify controlled write/rollback and Ads feed validation | Approval-bound effect receipt; PAUSED projection proof |
| Sep 1 | Public deployment and full clean-session rehearsal | Live URL passes judge journey |
| Sep 2 | Feature freeze, video, submission text, screenshots | Final release candidate and submission package |
| Sep 3 | Buffer, final verification, submit before 9:00 p.m. BST | Devpost confirmation and immutable release tag |

## Stage 2 — Standalone and pluggable beta

Target window: four to eight weeks after the challenge, gated by merchant evidence rather than calendar alone.

### Concrete customer and job

Primary users:

- Shopify merchants with meaningful product catalogues and emerging AI-channel traffic.
- Commerce agencies managing product data and conversion work for several merchants.
- Product marketing and merchandising teams responsible for discoverability, claims, and channel consistency.

Core job:

> Audit which buyer needs an agent can verify, improve the product representation without inventing claims, approve it once, publish it safely, and learn whether agent-channel outcomes improve.

### Product capabilities

- Shopify OAuth, app installation, tenant isolation, and least-privilege scopes.
- Multi-product ingestion, batch readiness scoring, prioritization, and evidence gap queues.
- Merchant-editable buyer-intent batteries and evidence policies.
- Versioned variants, exact approval envelopes, scheduled publication, rollback, and audit export.
- Organic WebMCP readiness, Shopify Catalog/Agentic Storefront readiness, and OpenAI Ads projection from one approved representation.
- Ads insights and conversion measurement when account access permits, with synthetic and observed signals kept separate.
- Stable API/SDK and job contracts so another product can call the optimisation loop without embedding the UI.
- Operational persistence, authentication, rate limits, idempotency, secrets management, monitoring, and support diagnostics.

### Demand validation gates

Before scaling the build, validate:

- At least five merchant or agency discovery conversations around the readiness/evidence problem.
- At least three design partners willing to connect a controlled catalogue or provide representative exports.
- Repeated evidence that merchants cannot already solve the same job adequately through Shopify’s native Agentic dashboard, Catalog tooling, or existing feed/PIM workflows.
- A measurable before/after signal: resolved buyer intents, time saved, approved changes published, agent recommendation quality, referred sessions, or conversion outcomes.
- A plausible commercial buyer, budget owner, and pricing unit—store, product count, audit, or managed optimisation—not merely user enthusiasm.

### Stage 2 exit condition

A merchant or agency can onboard without developer intervention, audit a real multi-product catalogue, approve and publish a bounded change, inspect organic and paid channel readiness, and retrieve an outcome report. At least one recurring job and one credible willingness-to-pay signal must be demonstrated before expanding the platform surface.

## Stage 3 — Module inside the agentic-commerce platform

Target window: after Stage 2 contracts stabilize and the target platform’s current workflow/approval refactor exposes a compatible boundary.

Integration target: `ai-knowledge-hub/deep-dive-analysis-agentic-commerce-augmentation`.

### Architectural decision

Integrate through the target platform’s signed, idempotent external-agent job façade and registry contracts. Do not import its repositories or call capability executors directly. The host platform retains tenant, workflow, policy, approval, budget, and completion authority; Conversion Lab owns agent-conversion domain logic and returns typed findings, candidates, evaluations, and receipts.

### Capability pack

| Capability | Effect class | Result | Authority boundary |
| --- | --- | --- | --- |
| `audit_agent_conversion_readiness` | Read | Evidence gaps, intent coverage, channel blockers | Source freshness and tenant/product identity required |
| `propose_evidence_bound_representation` | Proposal | Candidate copy plus evidence bindings | No publication authority |
| `evaluate_agent_selection` | Read/simulation | Frozen task battery and comparative result | Synthetic evidence labeled and versioned |
| `stage_representation_for_approval` | Internal reversible effect | Approval-ready immutable candidate | Exact product, evidence and payload digest |
| `publish_approved_representation` | External governed effect | Shopify receipt and rollback reference | Current approval envelope and native identity revalidated |
| `prepare_paid_channel_projection` | Preview or governed effect | Feed/PAUSED Ads receipt | Account scope, approval, PAUSED state and idempotency required |
| `observe_agent_channel_outcomes` | Read/feedback | Normalized organic/paid observations | Source identity, dedupe, completeness and time window retained |

### Cross-system contract

Conversion Lab objects map into the platform without semantic compression:

| Conversion Lab | Platform role | Contract rule |
| --- | --- | --- |
| Store/product native ID | Tenant/brand/product reference | Preserve provider-native identity and provenance |
| Evidence record | Evidence/observation | Never becomes permission or product truth without source authority |
| Buyer-intent battery | Query battery/experiment task set | Freeze version for comparisons |
| Representation variant | Experiment candidate | Immutable content and evidence digest |
| Merchant approval | Workflow approval envelope | Bind principal, target, payload, evidence, policy, version and expiry |
| Shopify/Ads effect receipt | Capability receipt | Idempotent native ID, result, uncertainty and rollback owner |
| Outcome observation | Validation/calibration input | Keep observed, synthetic and inferred signals distinct |

### Integration acceptance

- Versioned schemas and golden fixtures pass in both repositories.
- Duplicate job delivery cannot duplicate publication or paid effects.
- A platform model or memory artifact cannot manufacture merchant approval.
- Partial, stale, unavailable, and contradictory evidence remain visible in platform summaries.
- The initial integration stays within the platform’s current bounded sequential operating envelope.
- One end-to-end job can audit, propose, pause for exact approval, execute a controlled effect, return a signed receipt, and ingest a later observation.

## Stage 4 — Learning growth product

This stage expands only after the standalone job and embedded contract show real demand.

Potential directions:

- Multi-platform product sources, PIM/CMS connectors, marketplaces, and non-Shopify commerce.
- Large-catalogue prioritization and evidence-completeness operations.
- Agent-selection eval libraries by category, region, audience, and channel.
- Cross-channel experiments connecting representation changes to observed discovery, recommendation, click, cart, and conversion signals.
- Versioned belief and memory updates that improve later hypotheses without becoming source authority.
- Evaluation-driven prompt, model, skill, and harness candidates with shadow tests, approval, activation receipts, monitoring, and rollback.
- Agency workspaces, client reporting, policy templates, and managed optimisation services.

The product should not become a general agent platform. Its durable domain is commerce representation and agent conversion; the larger platform supplies generic governed orchestration when needed.

## Product steering rules

Every implementation slice must name:

- the roadmap milestone and customer outcome it advances;
- the actor, state, identity, evidence, authority, and real-world effect involved;
- a branch using `feature/<short-name>` or `fix/<short-name>`;
- explicit acceptance evidence and the smallest relevant test portfolio;
- what remains simulated, projected, unsupported, or unknown;
- the cut line that protects the current milestone from attractive but non-essential work.

Roadmap progress may be updated when evidence is executable. A material promise, customer, channel, or architecture shift requires a dated decision with external evidence and an explicit product choice; it must not emerge silently from implementation convenience.

## Open decisions

| Decision | Current position | Evidence needed |
| --- | --- | --- |
| Hackathon hosting provider | Vercel selected; stable public URL and production-output smoke are delivered | Native WebMCP and second-session public rehearsal |
| Live Shopify proof | Optional read adapter and update preview delivered; live write remains stretch and must not block judging | Dev store and least-privilege credential availability |
| Live Ads proof | Validated CSV and PAUSED projection delivered; live API remains stretch | Eligible Ads account/API key and safe test objects |
| Initial standalone buyer | Shopify merchant vs commerce agency | Discovery interviews and onboarding friction |
| Pricing unit | Deferred | Willingness-to-pay conversations and usage shape |
| Platform integration timing | After standalone contracts and target approval refactor stabilize | Cross-repo schema review and refactor checkpoint |
| Observed outcome source | Deferred | Shopify/Agentic analytics, Ads insights, referral attribution, or merchant analytics access |

## Evidence baseline

The dated evidence behind this roadmap is recorded in [research/MARKET-SNAPSHOT-2026-08-28.md](research/MARKET-SNAPSHOT-2026-08-28.md). Future external-context reviews should add a new dated snapshot and propose explicit roadmap deltas rather than rewriting the historical evidence.
