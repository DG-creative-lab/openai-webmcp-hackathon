---
name: conversion-lab-product-steward
description: Steer Conversion Lab engineering against its product roadmap, define milestone-sized delivery slices, evaluate product drift, or research current commerce/WebMCP/Shopify/OpenAI Ads market and platform changes. Use for roadmap planning, prioritization, milestone selection, product evolution, integration sequencing, or external-context validation. Do not use for ordinary implementation when the milestone and acceptance criteria are already clear.
---

# Conversion Lab Product Steward

Keep engineering aligned to a validated commerce outcome while preserving the product’s evidence and authority boundaries.

## Choose a mode

- **Delivery steering:** select or refine the next milestone, define a build slice, diagnose roadmap drift, or assess completion.
- **External-context sensing:** verify whether platform capabilities, challenge rules, customer demand, competitors, or market conditions change the product decision.

Use both modes only when an implementation decision materially depends on current external facts.

## Establish the evidence boundary

1. Read `docs/PRODUCT-ROADMAP.md`, `docs/PRODUCT-CONTRACT.md`, and the relevant current code and tests.
2. Inspect current Git branch, working-tree state, merged work, and any active pull request before proposing another slice.
3. Separate repository evidence, external observation, product inference, chosen decision, and unresolved assumption.
4. For market or platform questions, read [references/market-sensing.md](references/market-sensing.md) and use current web research.

## Steer delivery

Select the nearest incomplete milestone that advances a user-visible outcome. Define:

- actor and customer job;
- current state and desired observable outcome;
- product objects, identities, evidence, authority, and external effects;
- smallest vertical implementation slice;
- explicit non-goals and cut line;
- `feature/<short-name>` or `fix/<short-name>` branch;
- acceptance evidence and rollback or recovery where an effect exists;
- dependencies and external access assumptions.

Prefer one coherent end-to-end slice over several disconnected components. Preserve credential-free demo behavior when adding optional live adapters.

Use `$webmcp-quality-harness` for selecting and extending deterministic test evidence once implementation begins. The product skill decides what outcome matters; the quality skill proves the implementation preserves it.

## Detect drift and evolution needs

Treat a product shift as a decision, not an accidental accumulation of features. Trigger a roadmap review when:

- a platform adds or removes a capability that duplicates or blocks the current value proposition;
- challenge rules, API access, pricing, permissions, or technical contracts change materially;
- repeated merchant evidence contradicts the chosen customer or job;
- observed outcomes fail to improve despite successful proxy metrics;
- a new integration would move the product into checkout, payment, budget, campaign activation, or another higher-authority effect;
- the target platform refactor changes the external-agent, approval, evidence, or workflow contract.

Update completed milestone status from executable evidence. For a material promise, customer, channel, architecture, or authority change, create a dated evidence snapshot and proposed roadmap delta; do not silently rewrite the historical rationale.

## Keep decision authority explicit

The skill may research, compare, propose, prioritize, and update agreed roadmap progress. It may not treat market claims as product truth, approve channel effects, activate campaigns, spend money, publish merchant content, lower quality gates, or make a breaking product pivot without an explicit user decision.

Do not put open-ended web research or model judgment in merge-blocking CI. CI remains deterministic. External sensing is a planning input that produces reviewable evidence and falsifiable recommendations.

## Output

For delivery steering, return:

1. recommended milestone and why now;
2. scope, cut line, and dependencies;
3. implementation slices and branch plan;
4. acceptance evidence;
5. risks, assumptions, and next decision point.

For external-context sensing, return:

1. dated observations with direct sources;
2. inference and confidence;
3. affected roadmap claims or milestones;
4. keep, adjust, pause, or pivot recommendation;
5. cheapest experiment or evidence needed next.
