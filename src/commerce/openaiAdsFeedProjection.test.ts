import { describe, expect, it } from "vitest";
import { digestApprovalPayload } from "./approvalBinding";
import { COMMERCE_CONTRACT_VERSION, type ApprovalEnvelope, type RepresentationVariant } from "./contracts";
import { createFieldworkFixtureSnapshot } from "./fieldworkFixture";
import { prepareOpenAIAdsFeedProjection } from "./openaiAdsFeedProjection";

async function approvedInput() {
  const snapshot = createFieldworkFixtureSnapshot();
  const copy = {
    title: "Approved commuter pack",
    description: "Approved evidence-led description.",
    bullets: ["Verified proof"],
  };
  const evidenceIds = snapshot.evidence.map((record) => record.id);
  const payloadDigest = await digestApprovalPayload({ target: snapshot.product.identity, copy, evidence: snapshot.evidence });
  const approval: ApprovalEnvelope = {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    assurance: "demo_ui_gesture",
    principalId: null,
    target: snapshot.product.identity,
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
    product: {
      identity: snapshot.product.identity,
      sku: snapshot.product.sku,
      brand: snapshot.product.brand,
      price: snapshot.product.price,
      currency: snapshot.product.currency,
      inventory: snapshot.product.inventory,
      productUrl: "https://conversion-lab-webmcp.vercel.app/",
      imageUrl: "https://conversion-lab-webmcp.vercel.app/commuter-pack.png",
    },
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

  it("rejects a product source for another target before creating an artifact", async () => {
    const input = await approvedInput();
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      product: { ...input.product, identity: { ...input.product.identity, productId: "gid://shopify/Product/999" } },
    })).rejects.toThrow(/product source does not match/i);
  });

  it("rejects invalid product fields and credential-bearing destination URLs", async () => {
    const input = await approvedInput();
    await expect(prepareOpenAIAdsFeedProjection({
      ...input,
      product: {
        ...input.product,
        sku: "x".repeat(101),
        productUrl: "https://user:secret@conversion-lab-webmcp.vercel.app/",
      },
    })).rejects.toThrow(/length:id|format:link/i);
  });
});
