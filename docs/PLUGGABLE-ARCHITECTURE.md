# Conversion Lab pluggable product architecture

Status: accepted product direction; implementation pending
Decision date: 2026-08-31
Nearest delivery slice: Stage 1.5 — Pluggable Core proof

## Decision summary

Conversion Lab will be one **headless agent-conversion optimisation product** with several delivery surfaces, not separate SaaS, Shopify, SDK, CLI, MCP and WebMCP products.

The durable product is the versioned optimisation core and its authority-preserving workflow:

```text
authoritative product truth
  → audit buyer-intent and channel readiness
  → propose an evidence-bound representation
  → evaluate the proposal
  → bind exact approval
  → prepare or execute a bounded channel effect
  → produce a portable receipt
  → observe later outcomes
```

The current Vercel application is the first reference host. It combines a merchant workspace, a fictional Shopify-style product, a shopper view, an in-memory lifecycle store and page-scoped WebMCP tools in one React application. It proves the workflow but is not yet an installable Shopify app, public SDK, hosted API or multi-tenant SaaS.

The next proof will separate a DOM-free core from that reference host, make the web application consume the same core, and expose a narrow TypeScript SDK plus CLI. That is a portability proof, not completion of the production beta.

## Product forms are delivery surfaces

| Surface | Primary user | Responsibility | Does not own |
| --- | --- | --- | --- |
| SaaS workspace | Merchant or agency operator | Hosted audit, review, approval and reporting experience | Provider-native product truth or implicit publication authority |
| Shopify app and storefront connector | Shopify merchant | Installation, catalogue ingestion, authenticated merchant context and storefront WebMCP exposure | Optimisation semantics or Ads activation |
| TypeScript SDK | Product engineer | Embedded access to typed optimisation capabilities | Tenancy, hosting or credentials by default |
| HTTP API | Remote application | Network boundary over the same application capabilities | Permission inferred from possession of a product ID |
| CLI | Developer, operator or CI job | Local audit, evaluation and receipt verification | Authenticated merchant approval or uncontrolled channel writes |
| MCP server | External agent host | Headless agent access to permitted semantic capabilities | Web-page state or merchant authority |
| WebMCP adapter | Agent visiting a merchant web experience | Page-scoped tools over the host's visible shared state | Global account access, approval or invisible external effects |
| Agentic-commerce capability pack | Governed host platform | Cross-system jobs using typed findings, candidates and receipts | Host tenancy, policy, budgets or completion authority |

SDK, API, CLI and MCP are access protocols. SaaS and Shopify are distribution and hosting forms. WebMCP is the browser collaboration surface. They converge on one core contract and must not reimplement lifecycle, evidence or approval rules independently.

## Whole-system map

```text
Product sources                         Delivery surfaces
┌────────────────────┐                 ┌──────────────────────────┐
│ Fixture / JSON     │                 │ React SaaS workspace     │
│ Shopify Admin      │                 │ Shopify embedded app     │
│ Future PIM / CMS   │                 │ CLI / SDK / HTTP API     │
└─────────┬──────────┘                 │ MCP / WebMCP adapters     │
          │ catalogue + evidence       └────────────┬─────────────┘
          ▼                                         │ semantic calls
┌───────────────────────────────────────────────────▼─────────────┐
│                    Conversion Lab Core                         │
│ identity · evidence · audit · candidate · evaluation           │
│ lifecycle · approval binding · channel projection · receipts   │
└─────────┬───────────────────────┬───────────────────────┬───────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────┐
│ Shopify channel │   │ OpenAI Ads channel  │   │ Receipt / host  │
│ preview / write │   │ feed / PAUSED proof │   │ interoperability│
└─────────────────┘   └─────────────────────┘   └─────────────────┘
```

The core must not import React, browser globals, `document.modelContext`, a hard-coded product fixture, provider credentials or a process-wide singleton. Hosts provide those concerns through explicit ports.

## Core responsibilities and ports

### Core-owned responsibilities

- Versioned commerce identities and provider-native target references.
- Evidence content, provenance, freshness and completeness.
- Buyer-intent batteries and deterministic evaluation.
- Immutable representation candidates and legal lifecycle transitions.
- Exact approval payload construction and verification.
- Exact effect-grant validation without widening representation approval into execution authority.
- Channel projection validation and effect classification.
- Content-addressed optimisation receipts and semantic verification.
- Outcome lineage that preserves which representation and provider effect produced each observation.

### Host- or adapter-owned responsibilities

| Port | Host responsibility | Required boundary |
| --- | --- | --- |
| `CatalogueSource` | Load products and evidence | Preserve tenant, provider identity, provenance, freshness and partial states |
| `WorkspaceRepository` | Persist workspace and lifecycle state | Optimistic concurrency or equivalent stale-write protection |
| `Clock` | Supply validation and issuance time | Valid UTC time; deterministic substitute in tests |
| `ApprovalAuthority` | Attest principal, policy, scope and expiry for a representation decision | Approval bound to exact tenant, target, snapshot, representation and evidence digest; representation approval alone cannot authorize a channel effect |
| `EffectAuthority` | Issue or revoke an exact execution grant after projection | Grant binds capability, channel, operation, native destination/account, approval and representation digests, projection digest, effect limits, policy, expiry and replay semantics |
| `ReplayLedger` | Own durable logical-effect consumption and reconciliation state | Atomically claim one grant/effect with compare-and-set, lease and fencing token; never infer safety from an in-memory lock or provider idempotency alone |
| `ChannelProjector` | Prepare provider-specific preview | No execution authority; explicit unsupported and failure states |
| `ChannelExecutor` | Perform a governed external effect | Only the current replay-ledger claim owner may call the provider; revalidate the exact grant/projection after claim and persist the outcome before releasing ownership |
| `ReceiptSink` | Store or transmit portable receipts | Receipt integrity is not treated as execution authority |
| `OutcomeObserver` | Return later channel outcomes | Bind tenant/product, channel/account, representation digest, projection/effect receipt, native effect IDs and observation window; unresolved attribution remains partial or unknown |

The Stage 1.5 proof needs only an in-memory repository, injected clock, fixture/JSON catalogue source, existing preview projectors and receipt export. Production authorities and executors remain deferred.

## Capability surface

The same semantic capabilities may be exposed by the SDK, API, CLI, MCP, WebMCP or a host platform, subject to surface-specific authority:

| Capability | Class | Minimum input | Result | External effect |
| --- | --- | --- | --- | --- |
| `auditAgentConversionReadiness` | Read | Commerce snapshot and buyer-intent battery | Evidence gaps, intent coverage and channel blockers | None |
| `proposeEvidenceBoundRepresentation` | Proposal | Product identity, verified evidence and candidate copy | Immutable candidate with evidence bindings | None |
| `evaluateAgentSelection` | Read/simulation | Candidate, evidence and frozen battery version | Comparative deterministic result | None |
| `stageRepresentationForApproval` | Internal reversible state | Evaluated candidate | Approval-ready immutable state | None |
| `applyApprovalEnvelope` | Authority ingestion | Host-attested exact approval envelope | Approved lifecycle state or normalized rejection | None by itself |
| `prepareChannelProjection` | Preview | Current approval, representation and evidence | Shopify/Ads preview with effect metadata | None |
| `executeApprovedProjection` | Governed effect | Exact projection plus the current fenced replay-ledger claim on one immutable effect grant | Provider effect receipt and rollback reference | Possible; deferred |
| `observeChannelOutcomes` | Read/feedback | Exact effect lineage and bounded observation window | Attributed, partial or unknown observations with completeness | None |
| `exportOptimizationReceipt` | Read/export | Complete mutually consistent workflow | Content-addressed portable receipt | Local artifact only |
| `verifyOptimizationReceipt` | Read | Portable receipt | Integrity and semantic validation result | None |

Surface names may be idiomatic, but their inputs, authority and effects must map to these capabilities without semantic loss.

## Exact effect authorization

Representation approval and effect authorization are separate claims. An `ApprovalEnvelope` records that an exact evidence-bound representation passed the host's decision policy. It does not authorize Shopify publication, an Ads write or any other channel operation by itself.

Before an external effect, the authenticated host must issue one immutable `EffectGrant` bound to:

| Grant field | Required meaning |
| --- | --- |
| Grant identity | Versioned grant ID and tenant/workflow scope |
| Principal and policy | Authenticated principal, policy version, issued time and expiry |
| Exact capability | Semantic capability and operation, such as Shopify product publication or PAUSED Ads update |
| Channel destination | Provider, channel, native store/account and destination resource IDs |
| Product target | Provider-native product identity within the same tenant scope |
| Approved truth | Approval payload digest and representation digest |
| Exact projection | Projection digest and provider payload identity |
| Effect limits | Capability-specific allowed fields, quantity, required status and zero or bounded monetary budget |
| Revocation | Current revocation reference/version and non-revoked state |
| Replay policy | `single_use` or explicitly bounded idempotent retry, including one logical effect ID, the bound idempotency key and maximum permitted attempts; never authority for a second effect |

`executeApprovedProjection` must synchronously capture the grant and projection, atomically claim the logical effect in the durable replay ledger, then revalidate every binding immediately before execution. It must reject a mismatched capability, channel, operation, destination/account, target, approval or representation digest, projection digest, limit, policy, expiry, revocation version or replay state. The logical effect and idempotency key are part of the grant; a caller cannot choose a new key to create a second effect, and a retry may only reconcile or complete that same logical effect. Provider credentials prove only that a request can be made, not that this effect is authorized.

### Durable replay-ledger lifecycle

The ledger is keyed by tenant, grant ID and logical effect ID. Its state is authoritative across processes and survives worker restarts:

```text
issued
  └─ atomic compare-and-set claim ─→ claimed(claimId, workerId, fencingToken, leaseUntil, attempt)
                                      ├─→ succeeded(effect receipt / native IDs)
                                      ├─→ failed(authoritative no-effect result)
                                      └─→ ambiguous(unknown provider outcome)

ambiguous ── provider reconciliation ─→ succeeded | failed
failed ── bounded idempotent-retry policy only ─→ claimed(new claimId, higher fence, same logical effect/key)
```

Execution follows these rules:

1. All workers may validate inputs, but exactly one may atomically transition `issued → claimed`. A compare-and-set loser returns the current ledger state and must not call the provider.
2. The claim carries a unique claim ID, monotonically increasing fencing token, bounded lease and attempt number. Ledger writes from stale or lower-fenced workers are rejected.
3. The winner revalidates current claim ownership, fencing token, unexpired lease, grant, projection, revocation, expiry, limits and replay policy after claiming and immediately before the provider request.
4. The winner records `succeeded`, `failed` or `ambiguous` durably. Provider success followed by a process crash is treated as potentially ambiguous, never as safe to replay.
5. Claim lease expiry does not automatically permit takeover. It transitions or is reconciled to `ambiguous` because the previous worker may already have contacted a provider that lacks native idempotency.
6. `ambiguous` blocks every new provider call until reconciliation using the bound idempotency key, provider-native IDs, effect lookup or operator evidence resolves it to `succeeded` or authoritative `failed`. If the provider offers no reliable reconciliation, the state remains blocked for manual resolution.
7. A `single_use` grant cannot be claimed again after `failed`; a new exact grant is required. An explicitly bounded `idempotent_retry` grant may atomically re-enter `claimed` only after authoritative no-effect reconciliation, using the same logical effect and bound key with a higher fence and remaining attempt budget.

A process-local mutex, a preflight read followed by a write, or a provider idempotency key without atomic local ownership does not satisfy this contract.

## Authority allocation

| Claim or action | May propose | Verifier or attester | Authorizer | Executor | Retained evidence |
| --- | --- | --- | --- | --- | --- |
| Product identity and current catalogue facts | Adapter or agent query | Shopify or authoritative source adapter | Not applicable for reads | Catalogue source | Native ID, source, observation time and completeness |
| Representation candidate | Model, browser user or API caller | Deterministic evidence and schema validation | None | Core stores draft only | Candidate, evidence IDs and evaluation version |
| Buyer-intent result | Core evaluator | Frozen battery and authoritative evidence | None | Core | Inputs, battery version, result and timestamp |
| Merchant approval | Host UI or workflow | Authenticated host authority in production | Merchant representation policy | Core ingests envelope; does not invent it | Tenant, principal, policy, target, representation/payload digest, issue and expiry times |
| Exact effect grant | Approved workflow and prepared projection | Authenticated host effect authority | Channel/effect policy | Replay ledger atomically assigns one executor claim | Capability, channel, operation, destination/account, target, approval/representation/projection digests, limits, policy, expiry, revocation, replay policy and ledger state |
| Shopify publication | Approved workflow | Core revalidation plus Shopify permission, exact effect grant and current ledger claim | Current merchant effect policy | Shopify executor owned by fencing token | Grant/claim IDs, fence, attempt, projection digest, bound idempotency key, native response, observation and rollback reference |
| Paid preparation or write | Agent or operator | Core feed validators; exact effect authority and current ledger claim for any write | Paid-channel effect policy and budget | Ads adapter owned by fencing token | Grant/claim IDs, fence, feed/projection digest, account scope, required PAUSED state, budget limit and acceptance limits |
| Optimisation receipt | Core | Independent semantic and digest validation | Never authorizes an effect by itself | Host stores or transmits | Complete evidence, approval context, channel declarations and digest |
| Channel outcome observation | Provider adapter | Native event/effect lineage and deterministic attribution checks | Never authorizes an effect | Outcome observer | Tenant/product, channel/account, representation and projection digests, effect receipt/native IDs, window, source, completeness and attribution status |

No delivery surface may turn readable IDs, model confidence, a receipt digest, a WebMCP tool call, provider credentials or a caller-selected idempotency key into merchant approval or an exact effect grant.

## Outcome lineage and learning boundary

Every `OutcomeObservation` must identify:

- tenant and provider-native product target;
- channel and native store/account;
- approved representation digest;
- projection digest and effect-receipt identity;
- provider-native campaign, feed, product or equivalent effect IDs;
- observation-window start and end;
- source, observation time and deduplication identity;
- whether the signal is observed, synthetic or inferred;
- completeness and attribution status: `exact`, `partial` or `unknown`.

When two representations or effects overlap an observation window, the observer must split the window using authoritative effect times or report the affected metrics as partial/unknown. Product-level totals without resolvable representation/effect lineage may inform investigation but cannot be treated as candidate lift or update the learning loop as exact evidence. Late, duplicated, contradictory and unavailable observations remain visible rather than being silently reassigned to the current representation.

## Stage 1.5 — Pluggable Core proof

### Customer-visible claim

> The Conversion Lab website is one host of a reusable optimisation engine. The same product snapshot can be audited and its receipts verified without React, the demo storefront or `document.modelContext`.

### Smallest coherent implementation

1. Introduce a DOM-free `ConversionLabEngine` or equivalent application service over the existing versioned contracts.
2. Replace direct fixture construction inside the application store with injected `CommerceSnapshot`, clock and preview dependencies.
3. Keep one workspace instance shared by React and the WebMCP adapter so the visible-state promise remains intact.
4. Export a narrow TypeScript SDK entry point for audit, evaluation and receipt verification.
5. Add a CLI that consumes the same SDK and accepts versioned JSON input.
6. Include one non-React example input and machine-readable output.
7. Prove parity: identical inputs produce the same evaluation and receipt-verification result through the web host and CLI/SDK.

Candidate CLI contract:

```text
conversion-lab audit <commerce-snapshot.json>
conversion-lab evaluate <commerce-snapshot.json> <candidate.json>
conversion-lab verify-receipt <optimization-receipt.json>
```

The CLI should emit versioned JSON on stdout, diagnostics on stderr and a non-zero exit code for invalid input or failed verification. It must not approve, publish, upload, activate, spend, check out or pay.

### Explicit non-goals

- No public HTTP deployment, API keys, rate limits or remote persistence.
- No MCP server in the hackathon proof.
- No npm publication guarantee.
- No Shopify OAuth, app installation, live update or rollback.
- No authenticated merchant authority, multi-tenancy or billing.
- No Ads upload, API write, activation or spend.
- No migration of the agentic-commerce platform.

### Acceptance evidence

- Existing ten-tool WebMCP and browser journey remain behaviorally unchanged.
- Core and SDK modules import no React, DOM or page-scoped WebMCP code.
- The web host no longer imports the Fieldwork fixture as hidden global product truth inside a process-wide singleton construction path.
- CLI audit runs from a clean checkout without browser automation or credentials.
- CLI and web paths pass golden contract fixtures for identity, evidence, evaluation and receipt verification.
- Wrong-product evidence, stale approval, mutation, over-precise money and prohibited effects remain rejected.
- `make test-all` and native ChatGPT WebMCP acceptance both pass after extraction.

### Delivery estimate and cut line

The bounded proof is estimated at 8–14 focused engineering hours including tests and documentation. It may start only after native ChatGPT WebMCP acceptance and a second clean-session rehearsal pass. It must merge and deploy before the September 2 internal feature freeze; otherwise it is deferred intact.

## Evolution after the proof

### Standalone and Shopify beta

Add Shopify OAuth, tenant isolation, durable repositories, multi-product ingestion, authenticated approvals, controlled publication/rollback and outcome reporting. The SaaS workspace and Shopify embedded app remain two hosts of the same core.

### Remote API and MCP

Expose the application service through a versioned HTTP job contract after authentication, idempotency, persistence and cancellation semantics exist. An MCP server can then be a thin client of that API or SDK; it must not acquire broader authority than the caller and must not duplicate WebMCP's page collaboration role.

### Agentic-commerce platform

Integrate through the platform's signed, idempotent external-agent job façade. Conversion Lab owns domain findings, candidates, evaluations and receipts; the host retains tenant, workflow, approval, budget and completion authority.

## Principal risks and recovery

| Risk | Impact | Prevention | Recovery |
| --- | --- | --- | --- |
| UI and CLI implement different rules | Conflicting product truth and misleading portability claim | One core service and golden parity fixtures | Block release; remove the divergent adapter |
| Generic contracts erase Shopify identity | Cross-product or cross-tenant effects | Preserve provider-native identity and provenance end to end | Reject unsupported mapping; require explicit adapter change |
| Receipt becomes accidental authority | Unauthorized publication or paid effect | Receipts remain evidence artifacts; current grants are revalidated | Reject execution and record normalized denial |
| Representation approval is reused across channels | Shopify approval authorizes an Ads effect or a new destination | Separate exact effect grant bound to capability, channel, destination, projection, limits and replay | Reject before provider execution; revoke the malformed grant |
| Concurrent workers or retries duplicate an external effect | Duplicate publication or provider cost even with a valid single-use grant | Durable CAS replay ledger, one fenced claim owner, no automatic lease takeover and provider reconciliation | Keep ambiguous effects blocked; reconcile native state and use rollback where supported |
| Product-level outcomes are attributed to the wrong representation | Learning loop optimizes from corrupted evidence | Require representation/effect lineage and explicit partial/unknown attribution | Quarantine the observation and re-run attribution from provider-native events |
| Refactor destabilizes the judge journey | Submission failure despite stronger architecture | Stage 1.5 cut line, same browser acceptance and rollback by reverting the isolated branch | Defer proof and retain the current reference host |
| Extra protocols dilute the WebMCP story | Lower judging clarity | Ship SDK + CLI only; describe API/MCP as future adapters | Remove unproven surfaces from submission narrative |

## Open decisions

| Decision | Current position | Evidence needed |
| --- | --- | --- |
| SDK packaging | Repository-local TypeScript entry point first | Consumer spike before npm publication |
| Stateful engine shape | Injected workspace service with one owner per instance | Implementation spike and concurrent-state tests |
| CLI scope | Audit, evaluate and verify only | Judge/demo value and time remaining after acceptance |
| Canonical hosted boundary | SaaS likely becomes control plane; Shopify is an embedded host and connector | Merchant onboarding research |
| HTTP API timing | After persistence, authentication and idempotency | Stage 2 design-partner need |
| MCP timing | After stable SDK/API capability contract | Agentic-platform integration need; avoid WebMCP confusion |
| Non-Shopify support | JSON fixture proves contract portability, not provider completeness | A second authoritative catalogue adapter |
| Effect-grant attestation | Host-signed versioned grant with revocation and durable CAS replay ledger | Stage 2 identity/provider design, storage semantics and threat model |
| Outcome attribution source | Provider-native event/effect lineage before product-level aggregates | Shopify, Ads and referral attribution access |
