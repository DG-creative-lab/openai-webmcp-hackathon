import { beforeEach, describe, expect, it } from "vitest";
import { digestApprovalPayload } from "./approvalBinding";
import type { ApprovalEnvelope, EvidenceRecord, RepresentationVariant } from "./contracts";
import { prepareOpenAIAdsFeedProjection } from "./openaiAdsFeedProjection";
import { previewShopifyProductUpdate } from "./shopifyAdminPreview";
import {
  OPTIMIZATION_RECEIPT_FILENAME,
  canonicalOptimizationReceiptJson,
  createOptimizationReceipt,
  serializeOptimizationReceipt,
  verifyOptimizationReceiptDigest,
  type OptimizationReceiptInput,
} from "./optimizationReceipt";
import { appStore } from "../store/appStore";

async function completedInput(): Promise<OptimizationReceiptInput> {
  appStore.generateVariant("Agent");
  appStore.runEvaluation("Agent");
  appStore.stageVariant("Agent");
  await appStore.recordVisibleApproval();
  await appStore.publishVariant("Agent");
  await appStore.prepareAds("Agent");
  const state = appStore.getState();
  const payloadDigest = state.variant.approvedDigest!;
  const representation: RepresentationVariant = {
    contractVersion: state.variant.contractVersion,
    id: state.variant.id,
    productIdentity: state.variant.productIdentity,
    copy: {
      title: state.variant.title,
      description: state.variant.description,
      bullets: state.variant.bullets,
    },
    evidenceIds: state.variant.evidenceIds,
    payloadDigest,
    status: "published",
  };
  return {
    approval: state.variant.approval!,
    representation,
    evidence: state.evidence,
    baselineCopy: state.product.baseline,
    baselineEvaluation: state.baselineEvaluation,
    optimizedEvaluation: state.variantEvaluation!,
    shopifyPreview: state.commerce.updatePreview!,
    adsPackage: state.adsPackage,
    publishedAt: state.variant.publishedAt!,
    issuedAt: state.optimizationReceipt!.issuedAt,
  };
}

async function rebuildBindings(
  input: OptimizationReceiptInput,
  {
    approval: approvalChanges = {},
    evidence = input.evidence,
    publishedAt = input.publishedAt,
    issuedAt = input.issuedAt,
  }: {
    approval?: Partial<ApprovalEnvelope>;
    evidence?: readonly EvidenceRecord[];
    publishedAt?: string;
    issuedAt?: string;
  },
): Promise<OptimizationReceiptInput> {
  const approvalSeed: ApprovalEnvelope = { ...input.approval, ...approvalChanges };
  const payloadDigest = await digestApprovalPayload({
    target: approvalSeed.target,
    productSnapshot: approvalSeed.productSnapshot,
    copy: input.representation.copy,
    evidence,
  });
  const approval: ApprovalEnvelope = { ...approvalSeed, payloadDigest };
  const representation: RepresentationVariant = { ...input.representation, payloadDigest };
  const shopifyPreview = await previewShopifyProductUpdate({ approval, representation, evidence });
  const projection = await prepareOpenAIAdsFeedProjection({ approval, representation, evidence });
  return {
    ...input,
    approval,
    representation,
    evidence,
    shopifyPreview,
    adsPackage: {
      ...input.adsPackage,
      status: "ready",
      campaignStatus: "PAUSED",
      ...projection,
      adTemplate: {
        headline: representation.copy.title,
        description: representation.copy.description,
      },
    },
    publishedAt,
    issuedAt,
  };
}

describe("portable optimisation receipt", () => {
  beforeEach(() => appStore.reset());

  it("creates a deterministic, versioned receipt over approved organic and paid truth", async () => {
    const input = await completedInput();
    const first = await createOptimizationReceipt(input);
    const second = await createOptimizationReceipt(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      contractVersion: "conversion-lab.optimization-receipt.v1",
      assurance: {
        approval: "demo_ui_gesture",
        principalId: null,
        policyVersion: "conversion-lab.demo-approval.v1",
        approvedAt: input.approval.approvedAt,
        expiresAt: null,
        authenticatedMerchantAuthority: false,
        contentAddressed: true,
        cryptographicallySigned: false,
        verificationMethod: "sha256-v1-canonical-json",
      },
      target: { provider: "shopify", productId: "gid://shopify/Product/108828309" },
      productSnapshot: { sku: "URB-24-BLK", price: 159, currency: "GBP", inventory: 18 },
      evidenceSet: { freshness: "fixture", records: expect.arrayContaining([expect.objectContaining({ id: "ev-waterproof" })]) },
      evaluation: {
        batteryVersion: "conversion-lab.buyer-intent.v1",
        baseline: { score: 0, total: 8, copy: { title: "Modular Commuter Pack" } },
        optimized: { score: 8, total: 8 },
      },
      channels: {
        shopify: { operation: "update_product", status: "preview_ready", externalWrite: false },
        openaiAds: {
          campaignStatus: "PAUSED",
          projectedSpendMinor: 0,
          externalWrite: false,
          validation: {
            unverified: [
              "Product and image URLs resolve with HTTP 200",
              "Registered merchant name and feed configuration are accepted by OpenAI",
              "The row is accepted during OpenAI feed processing",
            ],
          },
        },
      },
      externalEffects: { shopifyWrite: false, adsActivation: false, adsSpendMinor: 0, payment: false },
      receiptDigest: expect.stringMatching(/^sha256-v1-[a-f0-9]{64}$/),
    });
    expect(await verifyOptimizationReceiptDigest(first)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("serializes one locally downloadable JSON artifact with its content digest", async () => {
    const receipt = await createOptimizationReceipt(await completedInput());
    const contents = await serializeOptimizationReceipt(receipt);
    const parsed = JSON.parse(contents);

    expect(OPTIMIZATION_RECEIPT_FILENAME).toBe("conversion-lab-optimization-receipt.json");
    expect(parsed.receiptDigest).toBe(receipt.receiptDigest);
    expect(parsed.channels.openaiAds.export.sourcePayloadDigest).toBe(parsed.representation.approvalDigest);
    expect(contents.endsWith("\n")).toBe(true);
  });

  it("detects any post-issuance receipt mutation", async () => {
    const receipt = await createOptimizationReceipt(await completedInput());
    const tampered = structuredClone(receipt);
    (tampered.productSnapshot as { price: number }).price = 1;

    expect(await verifyOptimizationReceiptDigest(tampered)).toBe(false);
    await expect(serializeOptimizationReceipt(tampered)).rejects.toThrow(/content digest/i);
  });

  it("canonicalizes object keys so the digest is portable across JSON property order", async () => {
    const receipt = await createOptimizationReceipt(await completedInput());
    const { receiptDigest, ...body } = structuredClone(receipt);
    const reordered = Object.fromEntries(Object.entries(body).reverse());

    expect(canonicalOptimizationReceiptJson(reordered)).toBe(canonicalOptimizationReceiptJson(body));
    expect(await verifyOptimizationReceiptDigest({ ...reordered, receiptDigest } as typeof receipt)).toBe(true);
  });

  it("captures an owned input before asynchronous verification", async () => {
    const input = structuredClone(await completedInput());
    const pending = createOptimizationReceipt(input);
    input.adsPackage.feed!.price = "1.00 GBP";
    input.adsPackage.feed!.link = "https://attacker.example/substituted";
    (input.representation.copy as { title: string }).title = "Changed during verification";

    const receipt = await pending;
    expect(receipt.productSnapshot.price).toBe(159);
    expect(receipt.channels.openaiAds.feed.price).toBe("159.00 GBP");
    expect(receipt.channels.openaiAds.feed.link).toBe("https://conversion-lab-webmcp.vercel.app/");
    expect(receipt.representation.copy.title).toBe("24L Waterproof Commuter Backpack + Pannier");
  });

  it("fails closed on substituted channel proof or evaluation semantics", async () => {
    const changedAds = structuredClone(await completedInput());
    changedAds.adsPackage.feed!.price = "1.00 GBP";
    await expect(createOptimizationReceipt(changedAds)).rejects.toThrow(/Ads projection/i);

    appStore.reset();
    const changedShopify = structuredClone(await completedInput());
    changedShopify.shopifyPreview.payload.variables.product = {
      id: changedShopify.approval.target.productId,
      title: "Different copy",
      descriptionHtml: changedShopify.representation.copy.description,
    };
    await expect(createOptimizationReceipt(changedShopify)).rejects.toThrow(/Shopify update preview/i);

    appStore.reset();
    const changedEvaluation = structuredClone(await completedInput());
    (changedEvaluation.optimizedEvaluation as { score: number }).score = 7;
    await expect(createOptimizationReceipt(changedEvaluation)).rejects.toThrow(/optimized evaluation/i);

    appStore.reset();
    const changedAdTemplate = structuredClone(await completedInput());
    changedAdTemplate.adsPackage.adTemplate!.headline = "Unapproved paid headline";
    await expect(createOptimizationReceipt(changedAdTemplate)).rejects.toThrow(/Ads projection/i);
  });

  it("recomputes and preserves every unresolved Ads acceptance caveat", async () => {
    const missingCaveats = structuredClone(await completedInput());
    missingCaveats.adsPackage.validation!.unverified = [];

    await expect(createOptimizationReceipt(missingCaveats)).rejects.toThrow(/unresolved acceptance checks/i);
  });

  it("requires evidence to predate approval even when every digest and channel projection is rebuilt", async () => {
    const input = await completedInput();
    const evidence = structuredClone(input.evidence);
    evidence[0].provenance.observedAt = "2026-08-30T08:01:00.000Z";
    const coordinated = await rebuildBindings(input, {
      approval: { approvedAt: "2026-08-30T08:00:00.000Z" },
      evidence,
      publishedAt: "2026-08-30T08:02:00.000Z",
      issuedAt: "2026-08-30T08:03:00.000Z",
    });

    await expect(createOptimizationReceipt(coordinated, { now: new Date("2026-08-30T12:00:00.000Z") }))
      .rejects.toThrow(/evidence observation must predate approval/i);
  });

  it("derives a chronological evidence range from mixed timestamp precision", async () => {
    const input = await completedInput();
    const evidence = structuredClone(input.evidence);
    evidence.forEach((record, index) => {
      record.provenance.observedAt = index === 0
        ? "2026-08-30T07:00:00Z"
        : `2026-08-30T07:00:00.00${index}Z`;
    });
    const coordinated = await rebuildBindings(input, {
      approval: { approvedAt: "2026-08-30T08:00:00.000Z" },
      evidence,
      publishedAt: "2026-08-30T08:02:00.000Z",
      issuedAt: "2026-08-30T08:03:00.000Z",
    });

    const receipt = await createOptimizationReceipt(coordinated, { now: new Date("2026-08-30T12:00:00.000Z") });
    expect(receipt.evidenceSet).toMatchObject({
      earliestObservedAt: "2026-08-30T07:00:00.000Z",
      latestObservedAt: "2026-08-30T07:00:00.007Z",
    });
    expect(Date.parse(receipt.evidenceSet.earliestObservedAt))
      .toBeLessThanOrEqual(Date.parse(receipt.evidenceSet.latestObservedAt));
  });

  it("rejects unsupported approval policy, expired approval, and unrepresentable assurance", async () => {
    const unsupportedPolicy = structuredClone(await completedInput());
    (unsupportedPolicy.approval as { policyVersion: string }).policyVersion = "unrecognized-policy";
    await expect(createOptimizationReceipt(unsupportedPolicy)).rejects.toThrow(/policy is unsupported/i);

    appStore.reset();
    const expired = structuredClone(await completedInput());
    (expired.approval as { expiresAt: string | null }).expiresAt = expired.approval.approvedAt;
    await expect(createOptimizationReceipt(expired)).rejects.toThrow(/approval expiry/i);

    appStore.reset();
    const authenticated = structuredClone(await completedInput());
    (authenticated.approval as { assurance: string }).assurance = "authenticated_merchant";
    (authenticated.approval as { principalId: string | null }).principalId = "merchant-123";
    await expect(createOptimizationReceipt(authenticated)).rejects.toThrow(/supports only.*demo approval/i);
  });

  it("carries a valid optional approval expiry for downstream policy enforcement", async () => {
    const expiring = structuredClone(await completedInput());
    (expiring.approval as { expiresAt: string | null }).expiresAt = "2099-01-01T00:00:00.000Z";

    const receipt = await createOptimizationReceipt(expiring);
    expect(receipt.assurance).toMatchObject({
      principalId: null,
      policyVersion: "conversion-lab.demo-approval.v1",
      approvedAt: expiring.approval.approvedAt,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
  });

  it("rejects pre-publication state and inconsistent lifecycle timestamps", async () => {
    const unpublished = structuredClone(await completedInput());
    (unpublished.representation as { status: string }).status = "approved";
    await expect(createOptimizationReceipt(unpublished)).rejects.toThrow(/published first/i);

    appStore.reset();
    const futurePublication = structuredClone(await completedInput());
    futurePublication.issuedAt = "2020-01-01T00:00:00.000Z";
    await expect(createOptimizationReceipt(futurePublication)).rejects.toThrow(/timestamps are inconsistent/i);

    appStore.reset();
    const futureIssuance = structuredClone(await completedInput());
    futureIssuance.issuedAt = "2099-01-01T00:00:00.000Z";
    await expect(createOptimizationReceipt(futureIssuance, { now: new Date("2026-08-30T12:00:00.000Z") }))
      .rejects.toThrow(/timestamps are inconsistent/i);
  });
});
