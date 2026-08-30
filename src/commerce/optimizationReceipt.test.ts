import { beforeEach, describe, expect, it } from "vitest";
import type { RepresentationVariant } from "./contracts";
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
        openaiAds: { campaignStatus: "PAUSED", projectedSpendMinor: 0, externalWrite: false },
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
