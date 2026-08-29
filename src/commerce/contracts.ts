export const COMMERCE_CONTRACT_VERSION = "conversion-lab.commerce.v1" as const;

export type CommerceContractVersion = typeof COMMERCE_CONTRACT_VERSION;
export type CommerceProvider = "fixture" | "shopify";

export interface CommerceIdentity {
  provider: CommerceProvider;
  storeId: string;
  productId: string;
}

export interface SourceProvenance {
  source: string;
  reference: string;
  observedAt: string;
  freshness: "fixture" | "live";
}

export interface CommerceCopy {
  title: string;
  description: string;
  bullets: string[];
}

export interface CommerceProduct {
  contractVersion: CommerceContractVersion;
  identity: CommerceIdentity;
  sku: string;
  handle: string;
  brand: string;
  price: number;
  currency: "GBP";
  inventory: number;
  image: string;
  baseline: CommerceCopy;
  provenance: SourceProvenance;
}

export interface EvidenceRecord {
  contractVersion: CommerceContractVersion;
  productIdentity: CommerceIdentity;
  id: string;
  label: string;
  value: string;
  source: string;
  verified: boolean;
  tags: string[];
  provenance: SourceProvenance;
}

export interface RepresentationVariant {
  contractVersion: CommerceContractVersion;
  id: string;
  productIdentity: CommerceIdentity;
  copy: CommerceCopy;
  evidenceIds: string[];
  payloadDigest: string;
  status: "draft" | "staged" | "approved" | "published";
}

export interface EvaluationResult {
  contractVersion: CommerceContractVersion;
  variantId: string;
  batteryVersion: string;
  score: number;
  total: number;
  createdAt: string;
}

export interface ApprovalEnvelope {
  contractVersion: CommerceContractVersion;
  assurance: "demo_ui_gesture" | "authenticated_merchant";
  principalId: string | null;
  target: CommerceIdentity;
  payloadDigest: string;
  evidenceIds: string[];
  policyVersion: string;
  approvedAt: string;
  expiresAt: string | null;
}

export interface ChannelProjection<TPayload = unknown> {
  contractVersion: CommerceContractVersion;
  channel: "shopify_admin" | "openai_ads";
  mode: "preview" | "live";
  status: "preview_ready" | "applied" | "failed" | "unsupported";
  target: CommerceIdentity;
  payloadDigest: string | null;
  externalWrite: boolean;
  payload: TPayload;
}

export interface EffectReceipt {
  contractVersion: CommerceContractVersion;
  effect: "commerce_product_read" | "shopify_product_update" | "openai_ads_projection";
  status: "succeeded" | "failed" | "uncertain" | "simulated";
  target: CommerceIdentity;
  externalEffect: boolean;
  nativeId: string | null;
  payloadDigest: string | null;
  occurredAt: string;
  rollbackReference: string | null;
}

export interface CommerceSnapshot {
  contractVersion: CommerceContractVersion;
  mode: "fixture" | "shopify";
  product: CommerceProduct;
  evidence: EvidenceRecord[];
  readReceipt: EffectReceipt;
}
