import { describe, expect, it } from "vitest";
import { digestApprovalPayload } from "./approvalBinding";
import { COMMERCE_CONTRACT_VERSION, type ApprovalEnvelope, type CommerceCopy, type EvidenceRecord, type RepresentationVariant } from "./contracts";
import { createFieldworkFixtureSnapshot } from "./fieldworkFixture";
import { previewShopifyProductRead, previewShopifyProductUpdate, SHOPIFY_ADMIN_API_VERSION } from "./shopifyAdminPreview";

function approvedBinding(copy: CommerceCopy = { title: "Approved title", description: "Approved description", bullets: ["Approved evidence"] }) {
  const snapshot = createFieldworkFixtureSnapshot();
  const target = snapshot.product.identity;
  const evidenceIds = snapshot.evidence.map((record) => record.id);
  const payloadDigest = digestApprovalPayload({ target, copy, evidence: snapshot.evidence });
  const approval: ApprovalEnvelope = {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    assurance: "demo_ui_gesture",
    principalId: null,
    target,
    payloadDigest,
    evidenceIds,
    policyVersion: "conversion-lab.demo-approval.v1",
    approvedAt: "2026-08-29T08:00:00.000Z",
    expiresAt: null,
  };
  const representation: RepresentationVariant = {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    id: "variant-test-v1",
    productIdentity: target,
    copy,
    evidenceIds,
    payloadDigest,
    status: "approved",
  };
  return { approval, representation, evidence: snapshot.evidence };
}

describe("versioned commerce adapter spine", () => {
  it("binds every fixture fact to one versioned native product identity", () => {
    const snapshot = createFieldworkFixtureSnapshot();
    expect(snapshot).toMatchObject({
      contractVersion: COMMERCE_CONTRACT_VERSION,
      mode: "fixture",
      product: {
        identity: { provider: "shopify", storeId: "fieldwork-demo.myshopify.com", productId: "gid://shopify/Product/108828309" },
        provenance: { freshness: "fixture" },
      },
      readReceipt: { status: "simulated", externalEffect: false },
    });
    expect(snapshot.evidence).toHaveLength(8);
    expect(snapshot.evidence.every((record) => record.productIdentity.productId === snapshot.product.identity.productId)).toBe(true);
    expect(snapshot.evidence.every((record) => record.contractVersion === COMMERCE_CONTRACT_VERSION && record.provenance.freshness === "fixture")).toBe(true);
  });

  it("returns a fresh fixture snapshot instead of sharing mutable adapter state", () => {
    const first = createFieldworkFixtureSnapshot();
    const second = createFieldworkFixtureSnapshot();
    first.evidence[0].tags.push("mutated");
    expect(second.evidence[0].tags).not.toContain("mutated");
  });

  it("builds a version-pinned, credential-free Shopify product read preview", () => {
    const preview = previewShopifyProductRead("fieldwork-demo.myshopify.com", "gid://shopify/Product/108828309");
    expect(preview).toMatchObject({
      apiVersion: SHOPIFY_ADMIN_API_VERSION,
      operation: "read_product",
      externalWrite: false,
      payload: {
        endpoint: `https://fieldwork-demo.myshopify.com/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
        variables: { id: "gid://shopify/Product/108828309" },
        requiredScopes: ["read_products"],
        execution: "blocked_preview",
      },
    });
    expect(JSON.stringify(preview)).not.toMatch(/access[_-]?token|secret|authorization/i);
  });

  it("recomputes and binds an update preview to the exact approval, product, copy, and evidence", () => {
    const binding = approvedBinding();
    const preview = previewShopifyProductUpdate(binding);
    expect(preview).toMatchObject({
      operation: "update_product",
      payloadDigest: binding.approval.payloadDigest,
      externalWrite: false,
      payload: {
        variables: { product: { id: "gid://shopify/Product/108828309", title: "Approved title", descriptionHtml: "Approved description" } },
        requiredScopes: ["write_products"],
        execution: "blocked_preview",
      },
    });
    expect(preview.payload.query).toContain("productUpdate(product: $product)");
  });

  it.each([
    ["evil.example.com", "gid://shopify/Product/108828309", /shop domain/i],
    ["fieldwork-.myshopify.com", "gid://shopify/Product/108828309", /shop domain/i],
    [`${"a".repeat(64)}.myshopify.com`, "gid://shopify/Product/108828309", /shop domain/i],
    ["fieldwork-demo.myshopify.com", "gid://shopify/Order/108828309", /product identity/i],
  ])("rejects an untrusted or invalid Shopify target", (shopDomain, productId, expected) => {
    expect(() => previewShopifyProductRead(shopDomain, productId)).toThrow(expected);
  });

  it("accepts the 63-character DNS label boundary", () => {
    const label = "a".repeat(63);
    expect(previewShopifyProductRead(`${label}.myshopify.com`, "gid://shopify/Product/108828309").target.storeId).toBe(`${label}.myshopify.com`);
  });

  it("rejects cross-product and changed-copy digest reuse at the adapter boundary", () => {
    const binding = approvedBinding();
    const otherTarget = { ...binding.representation.productIdentity, productId: "gid://shopify/Product/999" };
    expect(() => previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, productIdentity: otherTarget },
    })).toThrow(/different products/i);
    expect(() => previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, copy: { ...binding.representation.copy, title: "Unapproved title" } },
    })).toThrow(/changed after approval/i);
  });

  it("rejects missing, wrong-product, or changed-provenance evidence at the adapter boundary", () => {
    const binding = approvedBinding();
    expect(() => previewShopifyProductUpdate({ ...binding, evidence: binding.evidence.slice(1) })).toThrow(/complete approved evidence set/i);
    expect(() => previewShopifyProductUpdate({
      ...binding,
      evidence: binding.evidence.map((record, index) => index === 0
        ? { ...record, productIdentity: { ...record.productIdentity, productId: "gid://shopify/Product/999" } }
        : record),
    })).toThrow(/different product target/i);
    expect(() => previewShopifyProductUpdate({
      ...binding,
      evidence: binding.evidence.map((record, index) => index === 0
        ? { ...record, provenance: { ...record.provenance, observedAt: "2026-08-29T09:00:00.000Z" } }
        : record),
    })).toThrow(/changed after approval/i);
  });

  it("rejects unsupported contracts and mismatched representation evidence", () => {
    const binding = approvedBinding();
    expect(() => previewShopifyProductUpdate({
      ...binding,
      approval: { ...binding.approval, contractVersion: "legacy" as never },
    })).toThrow(/unsupported commerce contract/i);
    expect(() => previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, evidenceIds: binding.representation.evidenceIds.slice(1) },
    })).toThrow(/different evidence sets/i);
    expect(() => previewShopifyProductUpdate({
      ...binding,
      approval: { ...binding.approval, evidenceIds: [...binding.approval.evidenceIds, binding.approval.evidenceIds[0]] },
      representation: { ...binding.representation, evidenceIds: [...binding.representation.evidenceIds, binding.representation.evidenceIds[0]] },
    })).toThrow(/unique/i);
    const emptyDigest = digestApprovalPayload({ target: binding.approval.target, copy: binding.representation.copy, evidence: [] });
    expect(() => previewShopifyProductUpdate({
      approval: { ...binding.approval, evidenceIds: [], payloadDigest: emptyDigest },
      representation: { ...binding.representation, evidenceIds: [], payloadDigest: emptyDigest },
      evidence: [],
    })).toThrow(/at least one verified evidence/i);
  });

  it("rejects unverified, unversioned, or provenance-free approved evidence", () => {
    const binding = approvedBinding();
    const replaceFirst = (replacement: Partial<EvidenceRecord>) => binding.evidence.map((record, index) => index === 0 ? { ...record, ...replacement } : record);
    expect(() => previewShopifyProductUpdate({ ...binding, evidence: replaceFirst({ verified: false }) })).toThrow(/not verified/i);
    expect(() => previewShopifyProductUpdate({ ...binding, evidence: replaceFirst({ contractVersion: "legacy" as never }) })).toThrow(/unsupported contract version/i);
    expect(() => previewShopifyProductUpdate({
      ...binding,
      evidence: replaceFirst({ provenance: { ...binding.evidence[0].provenance, observedAt: "" } }),
    })).toThrow(/missing provenance/i);
  });

  it("rejects a non-Shopify approval target or complete-but-empty copy", () => {
    const binding = approvedBinding();
    expect(() => previewShopifyProductUpdate({
      ...binding,
      approval: { ...binding.approval, target: { ...binding.approval.target, provider: "fixture" } },
    })).toThrow(/Shopify product identity/i);

    const blank = approvedBinding({ title: " ", description: "Description", bullets: [] });
    expect(() => previewShopifyProductUpdate(blank)).toThrow(/non-empty/i);
  });
});
