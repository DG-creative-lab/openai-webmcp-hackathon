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
  actor: "Browser user" | "Agent" | "System";
  action: string;
  detail: string;
  time: string;
}

export type ConstraintStatus = "supported" | "contradicted" | "unknown";

export interface ConstraintEvidence {
  id: string;
  label: string;
  value: string;
  source: string;
}

export interface ShopperConstraint {
  id: string;
  requirement: string;
  status: ConstraintStatus;
  evidence: ConstraintEvidence[];
  explanation: string;
}

export interface ShopperMatch {
  match: boolean;
  constraints: ShopperConstraint[];
  evidence: ConstraintEvidence[];
}

export interface OpenAIProductFeedRow {
  id: string;
  title: string;
  description: string;
  price: string;
  availability: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  availability_date?: string;
  link: string;
  image_link: string;
  brand: string;
  identifier_exists: "yes" | "no";
  gtin?: string;
  mpn?: string;
  is_ads_eligible: true;
}

export interface FeedValidation {
  scope: "local_schema";
  valid: boolean;
  errors: string[];
  unverified: string[];
}

export interface AdsPackage {
  status: "not_prepared" | "ready";
  campaignStatus: "not_created" | "PAUSED";
  feed: OpenAIProductFeedRow | null;
  validation: FeedValidation | null;
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
