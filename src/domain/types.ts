import type { ApprovalEnvelope, CommerceContractVersion, CommerceIdentity, EffectReceipt, EvidenceRecord, SourceProvenance } from "../commerce/contracts";
import type { OptimizationReceipt } from "../commerce/optimizationReceipt";
import type { ShopifyOperationPreview } from "../commerce/shopifyAdminPreview";

export type Surface = "studio" | "storefront";
export type VariantStatus = "baseline" | "draft" | "staged" | "approved" | "published";
export type Channel = "shopify-webmcp" | "openai-ads";

export type Evidence = EvidenceRecord;

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
  contractVersion: CommerceContractVersion;
  id: string;
  productIdentity: CommerceIdentity;
  status: VariantStatus;
  evidenceIds: string[];
  approvedDigest: string | null;
  approvedAt: string | null;
  approval: ApprovalEnvelope | null;
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

export interface OpenAIAdsFeedExport {
  format: "google-compatible-csv";
  filename: "conversion-lab-openai-ads-feed.csv";
  mediaType: "text/csv;charset=utf-8";
  encoding: "UTF-8";
  rowCount: number;
  contentDigest: string;
  sourcePayloadDigest: string;
  contents: string;
  delivery: {
    transport: "SFTP";
    requiresAdsManagerFeedConnection: true;
    advertiserApiUploadSupported: false;
  };
}

export interface AdsPackage {
  status: "not_prepared" | "ready";
  campaignStatus: "not_created" | "PAUSED";
  feed: OpenAIProductFeedRow | null;
  feedExport: OpenAIAdsFeedExport | null;
  validation: FeedValidation | null;
  adTemplate: { headline: string; description: string } | null;
  disclaimer: string;
}

export interface CommerceIntegrationState {
  mode: "fixture" | "shopify";
  contractVersion: CommerceContractVersion;
  sourceIdentity: CommerceIdentity;
  provenance: SourceProvenance;
  readReceipt: EffectReceipt;
  readPreview: ShopifyOperationPreview;
  updatePreview: ShopifyOperationPreview | null;
}

export interface AppState {
  surface: Surface;
  product: Product;
  evidence: EvidenceRecord[];
  variant: Variant;
  baselineEvaluation: Evaluation;
  variantEvaluation: Evaluation | null;
  commerce: CommerceIntegrationState;
  adsPackage: AdsPackage;
  optimizationReceipt: OptimizationReceipt | null;
  cartQuantity: number;
  webmcpAvailable: boolean;
  activities: Activity[];
}
