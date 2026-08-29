import { createFieldworkFixtureSnapshot } from "../commerce/fieldworkFixture";
import { assertApprovalBinding, assertEvidenceAuthority, digestApprovalPayload } from "../commerce/approvalBinding";
import { prepareOpenAIAdsFeedProjection } from "../commerce/openaiAdsFeedProjection";
import { previewShopifyProductRead, previewShopifyProductUpdate } from "../commerce/shopifyAdminPreview";
import { COMMERCE_CONTRACT_VERSION, type ApprovalEnvelope, type EvidenceRecord, type RepresentationVariant } from "../commerce/contracts";
import { evaluateCopy } from "../domain/evaluation";
import type { Activity, AppState, ProductCopy, Surface } from "../domain/types";

const commerceSnapshot = createFieldworkFixtureSnapshot();
const evidence: EvidenceRecord[] = commerceSnapshot.evidence.map((record) => ({
  ...record,
  productIdentity: { ...record.productIdentity },
  tags: [...record.tags],
  provenance: { ...record.provenance },
}));
const product = {
  id: commerceSnapshot.product.identity.productId,
  sku: commerceSnapshot.product.sku,
  handle: commerceSnapshot.product.handle,
  brand: commerceSnapshot.product.brand,
  price: commerceSnapshot.product.price,
  currency: commerceSnapshot.product.currency,
  inventory: commerceSnapshot.product.inventory,
  image: commerceSnapshot.product.image,
  baseline: { ...commerceSnapshot.product.baseline, bullets: [...commerceSnapshot.product.baseline.bullets] },
};

const variantCopy: ProductCopy = {
  title: "24L Waterproof Commuter Backpack + Pannier",
  description: "A 1.2kg, IPX6 waterproof commuter pack that clips securely to a bicycle rack, protects a 16-inch laptop and carries a weekend load. £159, with dispatch today for Friday delivery.",
  bullets: [
    "24L capacity with a suspended sleeve for laptops up to 16-inch",
    "Rack attachment load-tested to 12kg, then converts cleanly to backpack carry",
    "Five-year repair programme covers replaceable zips, buckles and seams",
  ],
};

const baselineEvaluation = evaluateCopy(product.baseline, evidence, "Current Shopify copy", commerceSnapshot.product.identity);

function initialVariant(): AppState["variant"] {
  return {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    id: "variant-urban-24-v1",
    productIdentity: { ...commerceSnapshot.product.identity },
    ...product.baseline,
    bullets: [...product.baseline.bullets],
    status: "baseline",
    evidenceIds: evidence.map((item) => item.id),
    approvedDigest: null,
    approvedAt: null,
    approval: null,
    publishedAt: null,
  };
}

function initialAdsPackage(): AppState["adsPackage"] {
  return {
    status: "not_prepared",
    campaignStatus: "not_created",
    feed: null,
    feedExport: null,
    validation: null,
    adTemplate: null,
    disclaimer: "Demo projection only. No Ads API call, campaign activation or spend can occur.",
  };
}

function initialCommerce(): AppState["commerce"] {
  const sourceIdentity = { ...commerceSnapshot.product.identity };
  return {
    mode: commerceSnapshot.mode,
    contractVersion: commerceSnapshot.contractVersion,
    sourceIdentity,
    provenance: { ...commerceSnapshot.product.provenance },
    readReceipt: { ...commerceSnapshot.readReceipt, target: { ...commerceSnapshot.readReceipt.target } },
    readPreview: previewShopifyProductRead(sourceIdentity.storeId, sourceIdentity.productId),
    updatePreview: null,
  };
}

const listeners = new Set<() => void>();

function freezeState<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((child) => freezeState(child));
    Object.freeze(value);
  }
  return value;
}

function activity(actor: Activity["actor"], action: string, detail: string): Activity {
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor,
    action,
    detail,
    time: new Date().toISOString(),
  };
}

function initialState(webmcpAvailable: boolean, resetByBrowserUser = false): AppState {
  return {
    surface: "studio",
    product,
    evidence,
    variant: initialVariant(),
    baselineEvaluation,
    variantEvaluation: null,
    commerce: initialCommerce(),
    adsPackage: initialAdsPackage(),
    cartQuantity: 0,
    webmcpAvailable,
    activities: [
      resetByBrowserUser
        ? activity("Browser user", "Demo reset", "Cleared evaluation, approval, channel projections and cart state. Returned to the verified baseline.")
        : activity("System", "Fixture adapter loaded", "8 provenance-bound fixture facts are ready through commerce contract v1; no Shopify request was sent."),
    ],
  };
}

let state: AppState = freezeState(initialState(false));

function update(recipe: (current: AppState) => AppState): AppState {
  state = freezeState(recipe(state));
  listeners.forEach((listener) => listener());
  return state;
}

function addActivity(current: AppState, actor: Activity["actor"], action: string, detail: string): Activity[] {
  return [activity(actor, action, detail), ...current.activities].slice(0, 12);
}

function evidenceForVariant(current: AppState): EvidenceRecord[] {
  const byId = new Map(current.evidence.map((record) => [record.id, record]));
  const selected = current.variant.evidenceIds.flatMap((id) => {
    const record = byId.get(id);
    return record ? [record] : [];
  });
  assertEvidenceAuthority(selected, current.variant.productIdentity, current.variant.evidenceIds);
  return selected;
}

function representationFor(current: AppState, payloadDigest: string): RepresentationVariant {
  return {
    contractVersion: current.variant.contractVersion,
    id: current.variant.id,
    productIdentity: current.variant.productIdentity,
    copy: {
      title: current.variant.title,
      description: current.variant.description,
      bullets: current.variant.bullets,
    },
    evidenceIds: current.variant.evidenceIds,
    payloadDigest,
    status: current.variant.status === "published" ? "published" : "approved",
  };
}

function assertWorkspaceUnchanged(expected: AppState, action: string): void {
  if (state !== expected) {
    throw new Error(`${action} blocked: the workspace changed while approval evidence was being verified; retry from current state.`);
  }
}

export const appStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSurface(surface: Surface) {
    update((current) => ({ ...current, surface }));
  },
  setWebmcpAvailable(webmcpAvailable: boolean) {
    update((current) => ({ ...current, webmcpAvailable }));
  },
  generateVariant(actor: Activity["actor"] = "Agent") {
    return update((current) => ({
      ...current,
      variant: {
        ...current.variant,
        ...variantCopy,
        status: "draft",
        approvedDigest: null,
        approvedAt: null,
        approval: null,
        publishedAt: null,
      },
      variantEvaluation: null,
      commerce: { ...current.commerce, updatePreview: null },
      adsPackage: initialAdsPackage(),
      activities: addActivity(current, actor, "Variant generated", "Rewrote the product around eight verified buyer-relevant facts."),
    })).variant;
  },
  runEvaluation(actor: Activity["actor"] = "Agent") {
    if (state.variant.status !== "draft") {
      throw new Error("Evaluation blocked: create an evidence-led draft first.");
    }
    const evaluation = evaluateCopy(state.variant, state.evidence, "Evidence-led variant", state.variant.productIdentity);
    update((current) => ({
      ...current,
      variantEvaluation: evaluation,
      activities: addActivity(current, actor, "Buyer-intent battery run", `${evaluation.score}/${evaluation.total} simulated buyer needs matched verified evidence.`),
    }));
    return evaluation;
  },
  stageVariant(actor: Activity["actor"] = "Agent") {
    if (state.variant.status !== "draft" || !state.variantEvaluation) {
      throw new Error("Only an evaluated draft can be staged for visible review.");
    }
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "staged", approvedDigest: null, approvedAt: null, approval: null },
      activities: addActivity(current, actor, "Variant staged", "The tested variant is ready at the visible review checkpoint; no live channel changed."),
    })).variant;
  },
  async recordVisibleApproval() {
    const candidate = state;
    if (candidate.variant.status !== "staged") throw new Error("Only a staged variant can be approved.");
    const approvedEvidence = evidenceForVariant(candidate);
    const approvedDigest = await digestApprovalPayload({ target: candidate.variant.productIdentity, copy: candidate.variant, evidence: approvedEvidence });
    assertWorkspaceUnchanged(candidate, "Approval");
    const approvedAt = new Date().toISOString();
    const approval: ApprovalEnvelope = {
      contractVersion: candidate.variant.contractVersion,
      assurance: "demo_ui_gesture",
      principalId: null,
      target: candidate.variant.productIdentity,
      payloadDigest: approvedDigest,
      evidenceIds: [...candidate.variant.evidenceIds],
      policyVersion: "conversion-lab.demo-approval.v1",
      approvedAt,
      expiresAt: null,
    };
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "approved", approvedDigest, approvedAt, approval },
      activities: addActivity(current, "Browser user", "Visible approval recorded", `Browser UI gesture bound to ${approvedDigest}; this credential-free demo does not authenticate the actor.`),
    })).variant;
  },
  async publishVariant(actor: Activity["actor"] = "Agent") {
    const candidate = state;
    const approvedEvidence = evidenceForVariant(candidate);
    const currentDigest = await digestApprovalPayload({ target: candidate.variant.productIdentity, copy: candidate.variant, evidence: approvedEvidence });
    assertWorkspaceUnchanged(candidate, "Publication");
    if (candidate.variant.status !== "approved" || !candidate.variant.approval || candidate.variant.approvedDigest !== currentDigest) {
      throw new Error("Publication blocked: this exact variant does not have current digest-bound approval state.");
    }
    const representation = representationFor(candidate, currentDigest);
    await assertApprovalBinding({ approval: candidate.variant.approval, representation, evidence: approvedEvidence });
    assertWorkspaceUnchanged(candidate, "Publication");
    const updatePreview = await previewShopifyProductUpdate({
      approval: candidate.variant.approval,
      representation,
      evidence: approvedEvidence,
    });
    assertWorkspaceUnchanged(candidate, "Publication");
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "published", publishedAt: new Date().toISOString() },
      commerce: { ...current.commerce, updatePreview },
      activities: addActivity(current, actor, "Shopify preview prepared", "The approved copy is visible in the demo storefront and mapped to a blocked Shopify Admin update preview; no live write occurred."),
    })).variant;
  },
  async prepareAds(actor: Activity["actor"] = "Agent") {
    const candidate = state;
    const approvedEvidence = evidenceForVariant(candidate);
    const currentDigest = await digestApprovalPayload({ target: candidate.variant.productIdentity, copy: candidate.variant, evidence: approvedEvidence });
    assertWorkspaceUnchanged(candidate, "Ads preparation");
    if (candidate.variant.status !== "published" || !candidate.variant.approval || candidate.variant.approvedDigest !== currentDigest) {
      throw new Error("Ads preparation blocked: publish the exact digest-approved variant first.");
    }
    const { feed, validation, feedExport } = await prepareOpenAIAdsFeedProjection({
      approval: candidate.variant.approval,
      representation: representationFor(candidate, currentDigest),
      evidence: approvedEvidence,
      product: {
        identity: candidate.commerce.sourceIdentity,
        sku: candidate.product.sku,
        brand: candidate.product.brand,
        price: candidate.product.price,
        currency: candidate.product.currency,
        inventory: candidate.product.inventory,
        productUrl: "https://conversion-lab-webmcp.vercel.app/",
        imageUrl: "https://conversion-lab-webmcp.vercel.app/commuter-pack.png",
      },
    });
    assertWorkspaceUnchanged(candidate, "Ads preparation");
    return update((current) => ({
      ...current,
      adsPackage: {
        ...current.adsPackage,
        status: "ready",
        campaignStatus: "PAUSED",
        feed,
        feedExport,
        validation,
        adTemplate: { headline: candidate.variant.title, description: candidate.variant.description },
      },
      activities: addActivity(current, actor, "Ads package prepared", "Created a digest-bound Google-compatible CSV export, locally schema-valid feed row and PAUSED campaign projection. Ads Manager feed connection, SFTP upload and OpenAI acceptance remain external; £0 spend."),
    })).adsPackage;
  },
  updateCart(quantity: number, actor: Activity["actor"] = "Agent") {
    const normalizedQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
    const safeQuantity = Math.max(0, Math.min(normalizedQuantity, state.product.inventory));
    update((current) => ({
      ...current,
      cartQuantity: safeQuantity,
      activities: addActivity(current, actor, "Demo cart updated", `${safeQuantity} item${safeQuantity === 1 ? "" : "s"} in cart; no checkout or payment performed.`),
    }));
    return safeQuantity;
  },
  reset() {
    state = freezeState(initialState(state.webmcpAvailable, true));
    listeners.forEach((listener) => listener());
    return state;
  },
};

export type AppStore = typeof appStore;
