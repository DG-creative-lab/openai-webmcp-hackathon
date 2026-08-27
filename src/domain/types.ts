export type Surface = "studio" | "storefront";
export type VariantStatus = "baseline" | "draft" | "staged" | "approved" | "published";
export type Channel = "shopify-webmcp" | "openai-ads";

export interface Evidence {
  id: string;
  label: string;
  value: string;
  source: string;
  verified: boolean;
  tags: string[];
}

export interface ProductCopy {
  title: string;
  description: string;
  bullets: string[];
}

export interface Product {
  id: string;
  sku: string;
  handle: string;
  brand: string;
  price: number;
  currency: "GBP";
  inventory: number;
  image: string;
  baseline: ProductCopy;
}

export interface Variant extends ProductCopy {
  id: string;
  status: VariantStatus;
  evidenceIds: string[];
  approvedDigest: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
}

export interface IntentResult {
  id: string;
  query: string;
  shortLabel: string;
  matched: boolean;
  evidenceId: string | null;
}

export interface Evaluation {
  id: string;
  label: string;
  score: number;
  total: number;
  results: IntentResult[];
  createdAt: string;
}

export interface Activity {
  id: string;
  actor: "Merchant" | "Agent" | "System";
  action: string;
  detail: string;
  time: string;
}

export interface AdsPackage {
  status: "not_prepared" | "ready";
  campaignStatus: "not_created" | "PAUSED";
  feed: Record<string, string | number | boolean> | null;
  adTemplate: { headline: string; description: string } | null;
  disclaimer: string;
}

export interface AppState {
  surface: Surface;
  product: Product;
  evidence: Evidence[];
  variant: Variant;
  baselineEvaluation: Evaluation;
  variantEvaluation: Evaluation | null;
  adsPackage: AdsPackage;
  cartQuantity: number;
  webmcpAvailable: boolean;
  activities: Activity[];
}
