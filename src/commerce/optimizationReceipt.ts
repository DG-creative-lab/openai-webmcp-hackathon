import { verifyApprovalBinding } from "./approvalBinding";
import type {
  ApprovalEnvelope,
  ApprovalProductSnapshot,
  CommerceCopy,
  CommerceIdentity,
  EvidenceRecord,
  RepresentationVariant,
} from "./contracts";
import { previewShopifyProductUpdate, type ShopifyOperationPreview } from "./shopifyAdminPreview";
import { evaluateCopy } from "../domain/evaluation";
import { serializeOpenAIAdsFeedRows } from "../domain/openaiAdsFeedExport";
import { validateOpenAIProductFeedRow } from "../domain/openaiProductFeed";
import type { AdsPackage, Evaluation, FeedValidation, IntentResult, OpenAIProductFeedRow } from "../domain/types";

export const OPTIMIZATION_RECEIPT_VERSION = "conversion-lab.optimization-receipt.v1" as const;
export const OPTIMIZATION_RECEIPT_FILENAME = "conversion-lab-optimization-receipt.json" as const;
export const BUYER_INTENT_BATTERY_VERSION = "conversion-lab.buyer-intent.v1" as const;
export const OPTIMIZATION_RECEIPT_APPROVAL_POLICY = "conversion-lab.demo-approval.v1" as const;

interface ReceiptEvaluation {
  score: number;
  total: number;
  results: IntentResult[];
}

export interface OptimizationReceiptBody {
  contractVersion: typeof OPTIMIZATION_RECEIPT_VERSION;
  issuedAt: string;
  assurance: {
    approval: "demo_ui_gesture";
    principalId: null;
    policyVersion: typeof OPTIMIZATION_RECEIPT_APPROVAL_POLICY;
    approvedAt: string;
    expiresAt: string | null;
    authenticatedMerchantAuthority: false;
    contentAddressed: true;
    cryptographicallySigned: false;
    verificationMethod: "sha256-v1-canonical-json";
  };
  target: CommerceIdentity;
  productSnapshot: ApprovalProductSnapshot;
  representation: {
    id: string;
    status: "published";
    copy: CommerceCopy;
    evidenceIds: string[];
    approvalDigest: string;
    approvedAt: string;
    publishedAt: string;
  };
  evidenceSet: {
    freshness: "fixture" | "live" | "mixed";
    earliestObservedAt: string;
    latestObservedAt: string;
    records: EvidenceRecord[];
  };
  evaluation: {
    batteryVersion: typeof BUYER_INTENT_BATTERY_VERSION;
    baseline: ReceiptEvaluation & { copy: CommerceCopy };
    optimized: ReceiptEvaluation;
  };
  channels: {
    shopify: {
      apiVersion: string;
      operation: "update_product";
      status: "preview_ready";
      payloadDigest: string;
      externalWrite: false;
      execution: "blocked_preview";
    };
    openaiAds: {
      status: "ready";
      campaignStatus: "PAUSED";
      feed: OpenAIProductFeedRow;
      adTemplate: { headline: string; description: string };
      validation: {
        scope: "local_schema";
        valid: true;
        errors: [];
        unverified: string[];
      };
      export: {
        format: "google-compatible-csv";
        filename: string;
        rowCount: 1;
        sourcePayloadDigest: string;
        contentDigest: string;
        delivery: {
          transport: "SFTP";
          requiresAdsManagerFeedConnection: true;
          advertiserApiUploadSupported: false;
          uploaded: false;
        };
      };
      externalWrite: false;
      projectedSpendMinor: 0;
    };
  };
  externalEffects: {
    shopifyWrite: false;
    adsSftpUpload: false;
    adsApiWrite: false;
    adsActivation: false;
    adsSpendMinor: 0;
    checkout: false;
    payment: false;
  };
}

export interface OptimizationReceipt extends OptimizationReceiptBody {
  receiptDigest: string;
}

export interface OptimizationReceiptInput {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
  baselineCopy: Readonly<CommerceCopy> & { readonly bullets: readonly string[] };
  baselineEvaluation: Readonly<Evaluation>;
  optimizedEvaluation: Readonly<Evaluation>;
  shopifyPreview: Readonly<ShopifyOperationPreview>;
  adsPackage: Readonly<AdsPackage>;
  publishedAt: string;
  issuedAt: string;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((nested) => deepFreeze(nested));
    Object.freeze(value);
  }
  return value;
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  const canonical = value.includes(".")
    ? value.replace(/\.(\d{1,3})Z$/, (_match, fraction: string) => `.${fraction.padEnd(3, "0")}Z`)
    : value.replace(/Z$/, ".000Z");
  return new Date(milliseconds).toISOString() === canonical;
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256-v1-${hex}`;
}

export function canonicalOptimizationReceiptJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Optimisation receipt blocked: canonical JSON cannot contain a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalOptimizationReceiptJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalOptimizationReceiptJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new Error("Optimisation receipt blocked: canonical JSON contains an unsupported value.");
}

function evaluationSnapshot(evaluation: Readonly<Evaluation>): ReceiptEvaluation {
  return {
    score: evaluation.score,
    total: evaluation.total,
    results: evaluation.results.map((result) => ({ ...result })),
  };
}

function assertEvaluation(
  label: string,
  copy: Readonly<CommerceCopy> & { readonly bullets: readonly string[] },
  evidence: readonly EvidenceRecord[],
  target: Readonly<CommerceIdentity>,
  evaluation: Readonly<Evaluation>,
): void {
  const expected = evaluateCopy(
    { title: copy.title, description: copy.description, bullets: [...copy.bullets] },
    [...evidence],
    label,
    target,
  );
  const actual = evaluationSnapshot(evaluation);
  const expectedSemantics = evaluationSnapshot(expected);
  if (JSON.stringify(actual) !== JSON.stringify(expectedSemantics)) {
    throw new Error(`Optimisation receipt blocked: the ${label.toLowerCase()} evaluation does not match the supplied copy and evidence.`);
  }
}

function expectedPrice(snapshot: Readonly<ApprovalProductSnapshot>): string {
  const minorUnits = Math.round(snapshot.price * 100);
  return `${Math.floor(minorUnits / 100)}.${String(minorUnits % 100).padStart(2, "0")} ${snapshot.currency}`;
}

async function assertShopifyPreview(
  preview: Readonly<ShopifyOperationPreview>,
  approval: Readonly<ApprovalEnvelope>,
  representation: Readonly<RepresentationVariant>,
  evidence: readonly EvidenceRecord[],
): Promise<void> {
  const expected = await previewShopifyProductUpdate({ approval, representation, evidence });
  if (JSON.stringify(preview) !== JSON.stringify(expected)) {
    throw new Error("Optimisation receipt blocked: the Shopify update preview is missing, changed, or not bound to the approved representation.");
  }
}

async function assertAdsPackage(
  adsPackage: Readonly<AdsPackage>,
  product: Readonly<ApprovalProductSnapshot>,
  representation: Readonly<RepresentationVariant>,
  payloadDigest: string,
  validationTime: Date,
): Promise<FeedValidation> {
  const feed = adsPackage.feed;
  const feedExport = adsPackage.feedExport;
  const validation = adsPackage.validation;
  if (
    adsPackage.status !== "ready"
    || adsPackage.campaignStatus !== "PAUSED"
    || !feed
    || !feedExport
    || !validation
    || validation.scope !== "local_schema"
    || validation.valid !== true
    || validation.errors.length !== 0
    || !adsPackage.adTemplate
    || adsPackage.adTemplate.headline !== representation.copy.title
    || adsPackage.adTemplate.description !== representation.copy.description
    || feedExport.sourcePayloadDigest !== payloadDigest
    || feedExport.rowCount !== 1
    || feed.id !== product.sku
    || feed.title !== representation.copy.title
    || feed.description !== representation.copy.description
    || feed.price !== expectedPrice(product)
    || feed.availability !== (product.inventory > 0 ? "in_stock" : "out_of_stock")
    || feed.link !== product.productUrl
    || feed.image_link !== product.imageUrl
    || feed.brand !== product.brand
    || feed.identifier_exists !== "no"
    || feed.gtin !== undefined
    || feed.mpn !== undefined
    || feed.availability_date !== undefined
    || feed.is_ads_eligible !== true
    || feedExport.format !== "google-compatible-csv"
    || feedExport.filename !== "conversion-lab-openai-ads-feed.csv"
    || feedExport.delivery.transport !== "SFTP"
    || feedExport.delivery.requiresAdsManagerFeedConnection !== true
    || feedExport.delivery.advertiserApiUploadSupported !== false
  ) {
    throw new Error("Optimisation receipt blocked: the OpenAI Ads projection is missing, changed, active, or not bound to the approved product truth.");
  }
  const expectedValidation = validateOpenAIProductFeedRow(feed, validationTime);
  if (JSON.stringify(validation) !== JSON.stringify(expectedValidation)) {
    throw new Error("Optimisation receipt blocked: the complete independent Ads validation result, including unresolved acceptance checks, is required.");
  }
  const expectedExport = await serializeOpenAIAdsFeedRows({ rows: [feed], now: validationTime });
  if (feedExport.contents !== expectedExport.contents || feedExport.contentDigest !== expectedExport.contentDigest) {
    throw new Error("Optimisation receipt blocked: the Ads feed contents do not match their declared content digest.");
  }
  return expectedValidation;
}

function freshness(records: readonly EvidenceRecord[]): "fixture" | "live" | "mixed" {
  const values = new Set(records.map((record) => record.provenance.freshness));
  return values.size === 1 ? records[0].provenance.freshness : "mixed";
}

function receiptBody(
  input: OptimizationReceiptInput,
  payloadDigest: string,
  adsValidation: Readonly<FeedValidation>,
): OptimizationReceiptBody {
  const evidence = [...input.evidence].sort((left, right) => left.id.localeCompare(right.id));
  const observedAt = evidence.map((record) => record.provenance.observedAt).sort();
  return {
    contractVersion: OPTIMIZATION_RECEIPT_VERSION,
    issuedAt: input.issuedAt,
    assurance: {
      approval: "demo_ui_gesture",
      principalId: null,
      policyVersion: OPTIMIZATION_RECEIPT_APPROVAL_POLICY,
      approvedAt: input.approval.approvedAt,
      expiresAt: input.approval.expiresAt,
      authenticatedMerchantAuthority: false,
      contentAddressed: true,
      cryptographicallySigned: false,
      verificationMethod: "sha256-v1-canonical-json",
    },
    target: { ...input.approval.target },
    productSnapshot: { ...input.approval.productSnapshot },
    representation: {
      id: input.representation.id,
      status: "published",
      copy: {
        title: input.representation.copy.title,
        description: input.representation.copy.description,
        bullets: [...input.representation.copy.bullets],
      },
      evidenceIds: [...input.representation.evidenceIds],
      approvalDigest: payloadDigest,
      approvedAt: input.approval.approvedAt,
      publishedAt: input.publishedAt,
    },
    evidenceSet: {
      freshness: freshness(evidence),
      earliestObservedAt: observedAt[0],
      latestObservedAt: observedAt.at(-1)!,
      records: evidence.map((record) => structuredClone(record)),
    },
    evaluation: {
      batteryVersion: BUYER_INTENT_BATTERY_VERSION,
      baseline: {
        copy: {
          title: input.baselineCopy.title,
          description: input.baselineCopy.description,
          bullets: [...input.baselineCopy.bullets],
        },
        ...evaluationSnapshot(input.baselineEvaluation),
      },
      optimized: evaluationSnapshot(input.optimizedEvaluation),
    },
    channels: {
      shopify: {
        apiVersion: input.shopifyPreview.apiVersion,
        operation: "update_product",
        status: "preview_ready",
        payloadDigest,
        externalWrite: false,
        execution: "blocked_preview",
      },
      openaiAds: {
        status: "ready",
        campaignStatus: "PAUSED",
        feed: structuredClone(input.adsPackage.feed!),
        adTemplate: { ...input.adsPackage.adTemplate! },
        validation: {
          scope: "local_schema",
          valid: true,
          errors: [],
          unverified: [...adsValidation.unverified],
        },
        export: {
          format: "google-compatible-csv",
          filename: input.adsPackage.feedExport!.filename,
          rowCount: 1,
          sourcePayloadDigest: payloadDigest,
          contentDigest: input.adsPackage.feedExport!.contentDigest,
          delivery: {
            transport: "SFTP",
            requiresAdsManagerFeedConnection: true,
            advertiserApiUploadSupported: false,
            uploaded: false,
          },
        },
        externalWrite: false,
        projectedSpendMinor: 0,
      },
    },
    externalEffects: {
      shopifyWrite: false,
      adsSftpUpload: false,
      adsApiWrite: false,
      adsActivation: false,
      adsSpendMinor: 0,
      checkout: false,
      payment: false,
    },
  };
}

export async function createOptimizationReceipt(
  input: OptimizationReceiptInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<OptimizationReceipt> {
  const captured = deepFreeze(structuredClone(input));
  const capturedNow = new Date(now.getTime());
  if (Number.isNaN(capturedNow.getTime())) {
    throw new Error("Optimisation receipt blocked: the validation clock is invalid.");
  }
  if (!isCanonicalTimestamp(captured.issuedAt) || !isCanonicalTimestamp(captured.publishedAt)) {
    throw new Error("Optimisation receipt blocked: issuedAt and publishedAt must be valid UTC timestamps.");
  }
  if (!isCanonicalTimestamp(captured.approval.approvedAt)
    || Date.parse(captured.publishedAt) < Date.parse(captured.approval.approvedAt)
    || Date.parse(captured.issuedAt) < Date.parse(captured.publishedAt)
    || Date.parse(captured.issuedAt) > capturedNow.getTime()) {
    throw new Error("Optimisation receipt blocked: approval, publication, and issuance timestamps are inconsistent.");
  }
  if (captured.approval.assurance !== "demo_ui_gesture") {
    throw new Error("Optimisation receipt blocked: v1 supports only the credential-free demo approval assurance.");
  }
  if (captured.approval.policyVersion !== OPTIMIZATION_RECEIPT_APPROVAL_POLICY) {
    throw new Error("Optimisation receipt blocked: the approval policy is unsupported.");
  }
  if (captured.approval.expiresAt !== null && (
    !isCanonicalTimestamp(captured.approval.expiresAt)
    || Date.parse(captured.approval.expiresAt) <= Date.parse(captured.approval.approvedAt)
    || Date.parse(captured.approval.expiresAt) <= Date.parse(captured.issuedAt)
  )) {
    throw new Error("Optimisation receipt blocked: the approval expiry is invalid or no longer current at issuance.");
  }
  if (captured.representation.status !== "published") {
    throw new Error("Optimisation receipt blocked: the exact approved representation must be published first.");
  }
  if (captured.approval.principalId !== null) {
    throw new Error("Optimisation receipt blocked: the demo approval gesture cannot claim an authenticated principal.");
  }

  const verified = await verifyApprovalBinding(captured);
  if (verified.evidence.some((record) => Date.parse(record.provenance.observedAt) >= Date.parse(captured.approval.approvedAt))) {
    throw new Error("Optimisation receipt blocked: every evidence observation must predate approval.");
  }
  assertEvaluation("Baseline", captured.baselineCopy, verified.evidence, verified.approval.target, captured.baselineEvaluation);
  assertEvaluation("Optimized", verified.representation.copy, verified.evidence, verified.approval.target, captured.optimizedEvaluation);
  if (captured.optimizedEvaluation.score < captured.baselineEvaluation.score) {
    throw new Error("Optimisation receipt blocked: the approved representation does not improve the deterministic intent score.");
  }
  await assertShopifyPreview(captured.shopifyPreview, verified.approval, verified.representation, verified.evidence);
  const adsValidation = await assertAdsPackage(
    captured.adsPackage,
    verified.approval.productSnapshot,
    verified.representation,
    verified.payloadDigest,
    new Date(captured.issuedAt),
  );

  const body = receiptBody(captured, verified.payloadDigest, adsValidation);
  return deepFreeze({ ...body, receiptDigest: await digest(canonicalOptimizationReceiptJson(body)) });
}

export async function verifyOptimizationReceiptDigest(receipt: Readonly<OptimizationReceipt>): Promise<boolean> {
  const { receiptDigest, ...body } = structuredClone(receipt);
  return receiptDigest === await digest(canonicalOptimizationReceiptJson(body));
}

export async function serializeOptimizationReceipt(receipt: Readonly<OptimizationReceipt>): Promise<string> {
  if (!await verifyOptimizationReceiptDigest(receipt)) {
    throw new Error("Optimisation receipt export blocked: the content digest does not match the receipt body.");
  }
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
