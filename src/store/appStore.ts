import { digestVariant, evaluateCopy } from "../domain/evaluation";
import { validateOpenAIProductFeedRow } from "../domain/openaiProductFeed";
import type { Activity, AppState, OpenAIProductFeedRow, ProductCopy, Surface } from "../domain/types";

const evidence = [
  { id: "ev-waterproof", label: "Weather protection", value: "IPX6 waterproof", source: "Independent spray test · LAB-117", verified: true, tags: ["waterproof", "rain"] },
  { id: "ev-laptop", label: "Laptop sleeve", value: "Fits up to 16-inch laptop", source: "Product specification · PS-24L", verified: true, tags: ["laptop", "commute"] },
  { id: "ev-repair", label: "Repair programme", value: "5 years for zips, buckles and seams", source: "Repair policy · RP-05", verified: true, tags: ["repair", "durability"] },
  { id: "ev-price", label: "Retail price", value: "£159", source: "Shopify price · live", verified: true, tags: ["price"] },
  { id: "ev-delivery", label: "Dispatch promise", value: "Dispatches today for Friday delivery", source: "Warehouse SLA · live", verified: true, tags: ["delivery"] },
  { id: "ev-weight", label: "Product weight", value: "1.2kg", source: "Product specification · PS-24L", verified: true, tags: ["weight"] },
  { id: "ev-rack", label: "Rack attachment", value: "Rack system tested to 12kg", source: "Load test · LAB-104", verified: true, tags: ["bike", "rack"] },
  { id: "ev-capacity", label: "Capacity", value: "24L", source: "Product specification · PS-24L", verified: true, tags: ["capacity"] },
];

const product = {
  id: "gid://shopify/Product/urban-24",
  sku: "URB-24-BLK",
  handle: "modular-commuter-24",
  brand: "Fieldwork Supply",
  price: 159,
  currency: "GBP" as const,
  inventory: 18,
  image: "/commuter-pack.png",
  baseline: {
    title: "Modular Commuter Pack",
    description: "A versatile technical bag designed for everyday movement through the city.",
    bullets: ["Flexible carry modes", "Durable construction", "Built for daily use"],
  },
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

const baselineEvaluation = evaluateCopy(product.baseline, evidence, "Current Shopify copy");

function initialVariant(): AppState["variant"] {
  return {
    id: "variant-urban-24-v1",
    ...product.baseline,
    bullets: [...product.baseline.bullets],
    status: "baseline",
    evidenceIds: evidence.map((item) => item.id),
    approvedDigest: null,
    approvedAt: null,
    publishedAt: null,
  };
}

function initialAdsPackage(): AppState["adsPackage"] {
  return {
    status: "not_prepared",
    campaignStatus: "not_created",
    feed: null,
    validation: null,
    adTemplate: null,
    disclaimer: "Demo projection only. No Ads API call, campaign activation or spend can occur.",
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
    adsPackage: initialAdsPackage(),
    cartQuantity: 0,
    webmcpAvailable,
    activities: [
      resetByBrowserUser
        ? activity("Browser user", "Demo reset", "Cleared evaluation, approval, channel projections and cart state. Returned to the verified baseline.")
        : activity("System", "Evidence synced", "8 verified Shopify and operations facts are ready for agent use."),
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
        publishedAt: null,
      },
      variantEvaluation: null,
      adsPackage: initialAdsPackage(),
      activities: addActivity(current, actor, "Variant generated", "Rewrote the product around eight verified buyer-relevant facts."),
    })).variant;
  },
  runEvaluation(actor: Activity["actor"] = "Agent") {
    if (state.variant.status !== "draft") {
      throw new Error("Evaluation blocked: create an evidence-led draft first.");
    }
    const evaluation = evaluateCopy(state.variant, state.evidence, "Evidence-led variant");
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
      variant: { ...current.variant, status: "staged", approvedDigest: null, approvedAt: null },
      activities: addActivity(current, actor, "Variant staged", "The tested variant is ready at the visible review checkpoint; no live channel changed."),
    })).variant;
  },
  recordVisibleApproval() {
    if (state.variant.status !== "staged") throw new Error("Only a staged variant can be approved.");
    const approvedDigest = digestVariant(state.variant, state.variant.evidenceIds);
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "approved", approvedDigest, approvedAt: new Date().toISOString() },
      activities: addActivity(current, "Browser user", "Visible approval recorded", `Browser UI gesture bound to ${approvedDigest}; this credential-free demo does not authenticate the actor.`),
    })).variant;
  },
  publishVariant(actor: Activity["actor"] = "Agent") {
    const currentDigest = digestVariant(state.variant, state.variant.evidenceIds);
    if (state.variant.status !== "approved" || state.variant.approvedDigest !== currentDigest) {
      throw new Error("Publication blocked: this exact variant does not have current digest-bound approval state.");
    }
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "published", publishedAt: new Date().toISOString() },
      activities: addActivity(current, actor, "Shopify projection published", "The approved copy is now visible in the demo storefront."),
    })).variant;
  },
  prepareAds(actor: Activity["actor"] = "Agent") {
    const currentDigest = digestVariant(state.variant, state.variant.evidenceIds);
    if (state.variant.status !== "published" || state.variant.approvedDigest !== currentDigest) {
      throw new Error("Ads preparation blocked: publish the exact digest-approved variant first.");
    }
    const copy = state.variant;
    const feed: OpenAIProductFeedRow = {
      id: state.product.sku,
      title: copy.title,
      description: copy.description,
      price: `${state.product.price}.00 GBP`,
      availability: state.product.inventory > 0 ? "in_stock" : "out_of_stock",
      link: `https://demo.invalid/products/${state.product.handle}`,
      image_link: "https://demo.invalid/commuter-pack.png",
      brand: state.product.brand,
      identifier_exists: "no",
      is_ads_eligible: true,
    };
    const validation = validateOpenAIProductFeedRow(feed);
    if (!validation.valid) throw new Error(`Ads preparation blocked: local feed schema failed (${validation.errors.join(", ")}).`);
    return update((current) => ({
      ...current,
      adsPackage: {
        ...current.adsPackage,
        status: "ready",
        campaignStatus: "PAUSED",
        feed,
        validation,
        adTemplate: { headline: copy.title, description: copy.description },
      },
      activities: addActivity(current, actor, "Ads package prepared", "Created a locally schema-valid Ads product-feed row and PAUSED campaign projection. URL reachability and OpenAI acceptance remain unverified; £0 spend."),
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
