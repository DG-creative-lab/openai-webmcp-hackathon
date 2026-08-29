import { describe, expect, it } from "vitest";
import { digestApprovalPayload } from "./approvalBinding";
import { COMMERCE_CONTRACT_VERSION, type ApprovalEnvelope, type ApprovalProductSnapshot, type RepresentationVariant } from "./contracts";
import { createFieldworkFixtureSnapshot } from "./fieldworkFixture";
import { prepareOpenAIAdsFeedProjection } from "./openaiAdsFeedProjection";

async function approvedInput() {
  const snapshot = createFieldworkFixtureSnapshot();
  const copy = {
    title: "Approved commuter pack",
    description: "Approved evidence-led description.",
    bullets: ["Verified proof"],
  };
  const productSnapshot: ApprovalProductSnapshot = {
    sku: snapshot.product.sku,
    brand: snapshot.product.brand,
    price: snapshot.product.price,
    currency: snapshot.product.currency,
    inventory: snapshot.product.inventory,
    productUrl: "https://conversion-lab-webmcp.vercel.app/",
    imageUrl: "https://conversion-lab-webmcp.vercel.app/commuter-pack.png",
  };
  const evidenceIds = snapshot.evidence.map((record) => record.id);
  const payloadDigest = await digestApprovalPayload({
    target: snapshot.product.identity,
    productSnapshot,
    copy,
    evidence: snapshot.evidence,
  });
  const approval: ApprovalEnvelope = {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    assurance: "demo_ui_gesture",
    principalId: null,
    target: snapshot.product.identity,
    productSnapshot,
    payloadDigest,
    evidenceIds,
    policyVersion: "conversion-lab.demo-approval.v1",
    approvedAt: "2026-08-29T12:00:00.000Z",
    expiresAt: null,
  };
  const representation: RepresentationVariant = {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    id: "variant-ads-test",
    productIdentity: snapshot.product.identity,
    copy,
    evidenceIds,
    payloadDigest,
    status: "published",
  };
  return {
    approval,
    representation,
    evidence: snapshot.evidence,
  };
}

describe("approval-bound OpenAI Ads feed projection", () => {
  it("constructs the feed and CSV from the exact approved representation", async () => {
    const input = await approvedInput();
    const result = await prepareOpenAIAdsFeedProjection(input);

    expect(result.feed).toMatchObject({
      id: "URB-24-BLK",
      title: input.representation.copy.title,
      description: input.representation.copy.description,
      price: "159.00 GBP",
      availability: "in_stock",
      identifier_exists: "no",
      is_ads_eligible: true,
    });
    expect(result.validation).toMatchObject({ scope: "local_schema", valid: true, errors: [] });
    expect(result.feedExport).toMatchObject({
      sourcePayloadDigest: input.approval.payloadDigest,
      contentDigest: expect.stringMatching(/^sha256-v1-[a-f0-9]{64}$/),
      rowCount: 1,
      delivery: { transport: "SFTP", advertiserApiUploadSupported: false },
    });
  });

  it("rejects changed copy or provenance even when the caller supplies the old approval", async () => {
    const input = await approvedInput();
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      representation: { ...input.representation, copy: { ...input.representation.copy, title: "Changed title" } },
    })).rejects.toThrow(/changed after approval/i);
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      evidence: input.evidence.map((record, index) => index === 0
        ? { ...record, provenance: { ...record.provenance, reference: "changed" } }
        : record),
    })).rejects.toThrow(/changed after approval/i);
  });

  it("does not accept an independently substitutable product source at the projection boundary", async () => {
    const input = await approvedInput();
    const result = await prepareOpenAIAdsFeedProjection({
      ...input,
      product: {
        identity: input.approval.target,
        sku: "SUBSTITUTED-SKU",
        brand: "Substituted Brand",
        price: 1,
        currency: "GBP",
        inventory: 0,
        productUrl: "https://attacker.example/substituted",
        imageUrl: "https://attacker.example/image.png",
      },
    } as Parameters<typeof prepareOpenAIAdsFeedProjection>[0] & { product: unknown });

    expect(result.feed).toMatchObject({
      id: input.approval.productSnapshot.sku,
      brand: input.approval.productSnapshot.brand,
      price: "159.00 GBP",
      availability: "in_stock",
      link: input.approval.productSnapshot.productUrl,
      image_link: input.approval.productSnapshot.imageUrl,
    });
  });

  it("uses one owned snapshot when caller inputs mutate during digest verification", async () => {
    const input = await approvedInput();
    const approvedDigest = input.approval.payloadDigest;
    const pending = prepareOpenAIAdsFeedProjection(input);
    const mutableProduct = input.approval.productSnapshot as {
      price: number;
      inventory: number;
      productUrl: string;
    };
    const mutableCopy = input.representation.copy as { title: string };

    mutableProduct.price = 1;
    mutableProduct.inventory = 0;
    mutableProduct.productUrl = "https://attacker.example/substituted";
    mutableCopy.title = "Changed during verification";

    const result = await pending;
    expect(result.feed).toMatchObject({
      title: "Approved commuter pack",
      price: "159.00 GBP",
      availability: "in_stock",
      link: "https://conversion-lab-webmcp.vercel.app/",
    });
    expect(result.feedExport.sourcePayloadDigest).toBe(approvedDigest);
  });

  it.each([
    ["sku", "SUBSTITUTED-SKU"],
    ["brand", "Substituted Brand"],
    ["price", 1],
    ["inventory", 0],
    ["productUrl", "https://attacker.example/substituted"],
    ["imageUrl", "https://attacker.example/image.png"],
  ] as const)("rejects reuse of the old approval after %s changes", async (field, value) => {
    const input = await approvedInput();
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      approval: {
        ...input.approval,
        productSnapshot: { ...input.approval.productSnapshot, [field]: value },
      },
    })).rejects.toThrow(/changed after approval/i);
  });

  it("fails closed for a missing or invalid approval product snapshot", async () => {
    const input = await approvedInput();
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      approval: { ...input.approval, productSnapshot: undefined as never },
    })).rejects.toThrow(/product snapshot is missing/i);
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      approval: {
        ...input.approval,
        productSnapshot: { ...input.approval.productSnapshot, productUrl: "https://user:secret@merchant.example/" },
      },
    })).rejects.toThrow(/snapshot URLs are invalid/i);
  });

  it("rejects prices that cannot be represented exactly at GBP minor-unit precision", async () => {
    const input = await approvedInput();
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      approval: {
        ...input.approval,
        productSnapshot: { ...input.approval.productSnapshot, price: 1.005 },
      },
    })).rejects.toThrow(/snapshot price is invalid/i);

    const preciseSnapshot = { ...input.approval.productSnapshot, price: 159.99 };
    const payloadDigest = await digestApprovalPayload({
      target: input.approval.target,
      productSnapshot: preciseSnapshot,
      copy: input.representation.copy,
      evidence: input.evidence,
    });
    const result = await prepareOpenAIAdsFeedProjection({
      ...input,
      approval: { ...input.approval, productSnapshot: preciseSnapshot, payloadDigest },
      representation: { ...input.representation, payloadDigest },
    });
    expect(result.feed.price).toBe("159.99 GBP");
  });
});
