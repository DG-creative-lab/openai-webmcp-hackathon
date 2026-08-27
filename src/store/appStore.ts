import { digestVariant, evaluateCopy } from "../domain/evaluation";
import type { Activity, AppState, ProductCopy, Surface } from "../domain/types";

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

let state: AppState = {
  surface: "studio",
  product,
  evidence,
  variant: {
    id: "variant-urban-24-v1",
    ...variantCopy,
    status: "draft",
    evidenceIds: evidence.map((item) => item.id),
    approvedDigest: null,
    approvedAt: null,
    publishedAt: null,
  },
  baselineEvaluation,
  variantEvaluation: null,
  adsPackage: {
    status: "not_prepared",
    campaignStatus: "not_created",
    feed: null,
    adTemplate: null,
    disclaimer: "Demo projection only. No Ads API call, campaign activation or spend can occur.",
  },
  cartQuantity: 0,
  webmcpAvailable: false,
  activities: [
    activity("System", "Evidence synced", "8 verified Shopify and operations facts are ready for agent use."),
  ],
};

const listeners = new Set<() => void>();

function activity(actor: Activity["actor"], action: string, detail: string): Activity {
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor,
    action,
    detail,
    time: new Date().toISOString(),
  };
}

function update(recipe: (current: AppState) => AppState): AppState {
  state = recipe(state);
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
      activities: addActivity(current, actor, "Variant generated", "Rewrote the product around eight verified buyer-relevant facts."),
    })).variant;
  },
  runEvaluation(actor: Activity["actor"] = "Agent") {
    const evaluation = evaluateCopy(state.variant, state.evidence, "Evidence-led variant");
    update((current) => ({
      ...current,
      variantEvaluation: evaluation,
      activities: addActivity(current, actor, "Buyer-intent battery run", `${evaluation.score}/${evaluation.total} simulated buyer needs matched verified evidence.`),
    }));
    return evaluation;
  },
  stageVariant(actor: Activity["actor"] = "Agent") {
    if (!state.variantEvaluation) throw new Error("Run the buyer-intent battery before staging.");
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "staged", approvedDigest: null, approvedAt: null },
      activities: addActivity(current, actor, "Variant staged", "The tested variant is ready for merchant review; no live channel changed."),
    })).variant;
  },
  approveVariant() {
    if (state.variant.status !== "staged") throw new Error("Only a staged variant can be approved.");
    const approvedDigest = digestVariant(state.variant, state.variant.evidenceIds);
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "approved", approvedDigest, approvedAt: new Date().toISOString() },
      activities: addActivity(current, "Merchant", "Variant approved", `Human approval bound to ${approvedDigest}.`),
    })).variant;
  },
  publishVariant(actor: Activity["actor"] = "Agent") {
    const currentDigest = digestVariant(state.variant, state.variant.evidenceIds);
    if (state.variant.status !== "approved" || state.variant.approvedDigest !== currentDigest) {
      throw new Error("Publication blocked: this exact variant does not have current merchant approval.");
    }
    return update((current) => ({
      ...current,
      variant: { ...current.variant, status: "published", publishedAt: new Date().toISOString() },
      activities: addActivity(current, actor, "Shopify projection published", "The approved copy is now visible in the demo storefront."),
    })).variant;
  },
  prepareAds(actor: Activity["actor"] = "Agent") {
    if (state.variant.status !== "published") {
      throw new Error("Ads preparation blocked: publish the exact merchant-approved variant first.");
    }
    const copy = state.variant;
    const feed = {
      id: state.product.sku,
      title: copy.title,
      description: copy.description,
      price: `${state.product.price}.00 GBP`,
      availability: state.product.inventory > 0 ? "in_stock" : "out_of_stock",
      link: `https://demo.invalid/products/${state.product.handle}`,
      image_link: "https://demo.invalid/commuter-pack.png",
      brand: state.product.brand,
      is_ads_eligible: true,
    };
    return update((current) => ({
      ...current,
      adsPackage: {
        ...current.adsPackage,
        status: "ready",
        campaignStatus: "PAUSED",
        feed,
        adTemplate: { headline: copy.title, description: copy.description },
      },
      activities: addActivity(current, actor, "Ads package prepared", "Created an Ads-eligible product-feed row and PAUSED campaign projection. £0 spend."),
    })).adsPackage;
  },
  updateCart(quantity: number, actor: Activity["actor"] = "Agent") {
    const safeQuantity = Math.max(0, Math.min(Math.floor(quantity), state.product.inventory));
    update((current) => ({
      ...current,
      cartQuantity: safeQuantity,
      activities: addActivity(current, actor, "Demo cart updated", `${safeQuantity} item${safeQuantity === 1 ? "" : "s"} in cart; no checkout or payment performed.`),
    }));
    return safeQuantity;
  },
  reset() {
    state = {
      ...state,
      surface: "studio",
      variant: { ...state.variant, status: "draft", approvedDigest: null, approvedAt: null, publishedAt: null },
      variantEvaluation: null,
      adsPackage: { ...state.adsPackage, status: "not_prepared", campaignStatus: "not_created", feed: null, adTemplate: null },
      cartQuantity: 0,
      activities: [activity("System", "Demo reset", "Returned the workspace to its initial review state.")],
    };
    listeners.forEach((listener) => listener());
  },
};

export type AppStore = typeof appStore;
