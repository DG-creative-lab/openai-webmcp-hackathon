import { describe, expect, it } from "vitest";
import { digestApprovalPayload } from "./approvalBinding";
import { COMMERCE_CONTRACT_VERSION, type ApprovalEnvelope, type CommerceCopy, type EvidenceRecord, type RepresentationVariant } from "./contracts";
import { createFieldworkFixtureSnapshot } from "./fieldworkFixture";
import { previewShopifyProductRead, previewShopifyProductUpdate, SHOPIFY_ADMIN_API_VERSION } from "./shopifyAdminPreview";

async function approvedBinding(copy: CommerceCopy = { title: "Approved title", description: "Approved description", bullets: ["Approved evidence"] }) {
  const snapshot = createFieldworkFixtureSnapshot();
  const target = snapshot.product.identity;
  const evidenceIds = snapshot.evidence.map((record) => record.id);
  const payloadDigest = await digestApprovalPayload({ target, copy, evidence: snapshot.evidence });
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

  it("recomputes and binds an update preview to the exact approval, product, copy, and evidence", async () => {
    const binding = await approvedBinding();
    const preview = await previewShopifyProductUpdate(binding);
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

  it("rejects cross-product and changed-copy digest reuse at the adapter boundary", async () => {
    const binding = await approvedBinding();
    const otherTarget = { ...binding.representation.productIdentity, productId: "gid://shopify/Product/999" };
    await expect(previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, productIdentity: otherTarget },
    })).rejects.toThrow(/different products/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, copy: { ...binding.representation.copy, title: "Unapproved title" } },
    })).rejects.toThrow(/changed after approval/i);
  });

  it("uses versioned SHA-256 so the known FNV-1a collision cannot reuse approval", async () => {
    const firstCopy = { title: "Candidate pju3ec-1uwi", description: "Approved description", bullets: ["Approved evidence"] };
    const secondCopy = { ...firstCopy, title: "Candidate 16stnjm-3ikt" };
    const binding = await approvedBinding(firstCopy);
    const secondDigest = await digestApprovalPayload({
      target: binding.approval.target,
      copy: secondCopy,
      evidence: binding.evidence,
    });

    expect(binding.approval.payloadDigest).toMatch(/^sha256-v1-[a-f0-9]{64}$/);
    expect(secondDigest).toMatch(/^sha256-v1-[a-f0-9]{64}$/);
    expect(secondDigest).not.toBe(binding.approval.payloadDigest);
    await expect(previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, copy: secondCopy },
    })).rejects.toThrow(/changed after approval/i);
  });

  it("rejects missing, wrong-product, or changed-provenance evidence at the adapter boundary", async () => {
    const binding = await approvedBinding();
    await expect(previewShopifyProductUpdate({ ...binding, evidence: binding.evidence.slice(1) })).rejects.toThrow(/complete approved evidence set/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      evidence: binding.evidence.map((record, index) => index === 0
        ? { ...record, productIdentity: { ...record.productIdentity, productId: "gid://shopify/Product/999" } }
        : record),
    })).rejects.toThrow(/different product target/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      evidence: binding.evidence.map((record, index) => index === 0
        ? { ...record, provenance: { ...record.provenance, observedAt: "2026-08-29T09:00:00.000Z" } }
        : record),
    })).rejects.toThrow(/changed after approval/i);
  });

  it("rejects unsupported contracts and mismatched representation evidence", async () => {
    const binding = await approvedBinding();
    await expect(previewShopifyProductUpdate({
      ...binding,
      approval: { ...binding.approval, contractVersion: "legacy" as never },
    })).rejects.toThrow(/unsupported commerce contract/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      representation: { ...binding.representation, evidenceIds: binding.representation.evidenceIds.slice(1) },
    })).rejects.toThrow(/different evidence sets/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      approval: { ...binding.approval, evidenceIds: [...binding.approval.evidenceIds, binding.approval.evidenceIds[0]] },
      representation: { ...binding.representation, evidenceIds: [...binding.representation.evidenceIds, binding.representation.evidenceIds[0]] },
    })).rejects.toThrow(/unique/i);
    const emptyDigest = await digestApprovalPayload({ target: binding.approval.target, copy: binding.representation.copy, evidence: [] });
    await expect(previewShopifyProductUpdate({
      approval: { ...binding.approval, evidenceIds: [], payloadDigest: emptyDigest },
      representation: { ...binding.representation, evidenceIds: [], payloadDigest: emptyDigest },
      evidence: [],
    })).rejects.toThrow(/at least one verified evidence/i);
  });

  it("rejects unverified, unversioned, or provenance-free approved evidence", async () => {
    const binding = await approvedBinding();
    const replaceFirst = (replacement: Partial<EvidenceRecord>) => binding.evidence.map((record, index) => index === 0 ? { ...record, ...replacement } : record);
    await expect(previewShopifyProductUpdate({ ...binding, evidence: replaceFirst({ verified: false }) })).rejects.toThrow(/not verified/i);
    await expect(previewShopifyProductUpdate({ ...binding, evidence: replaceFirst({ contractVersion: "legacy" as never }) })).rejects.toThrow(/unsupported contract version/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      evidence: replaceFirst({ provenance: { ...binding.evidence[0].provenance, source: "" } }),
    })).rejects.toThrow(/missing provenance/i);
    await expect(previewShopifyProductUpdate({
      ...binding,
      evidence: replaceFirst({ provenance: { ...binding.evidence[0].provenance, observedAt: "" } }),
    })).rejects.toThrow(/invalid observedAt timestamp/i);
  });

  it("rejects self-consistently rehashed evidence with missing freshness or an impossible timestamp", async () => {
    const binding = await approvedBinding();
    const assertInvalidProvenance = async (evidence: EvidenceRecord[], expected: RegExp) => {
      const payloadDigest = await digestApprovalPayload({ target: binding.approval.target, copy: binding.representation.copy, evidence });
      await expect(previewShopifyProductUpdate({
        approval: { ...binding.approval, payloadDigest },
        representation: { ...binding.representation, payloadDigest },
        evidence,
      })).rejects.toThrow(expected);
    };

    const withoutFreshness = binding.evidence.map((record, index) => {
      if (index !== 0) return record;
      const provenance: Partial<EvidenceRecord["provenance"]> = { ...record.provenance };
      delete provenance.freshness;
      return { ...record, provenance };
    }) as EvidenceRecord[];
    await assertInvalidProvenance(withoutFreshness, /invalid freshness/i);

    const impossibleObservedAt = binding.evidence.map((record, index) => index === 0
      ? { ...record, provenance: { ...record.provenance, observedAt: "2099-02-30T00:00:00.000Z" } }
      : record);
    await assertInvalidProvenance(impossibleObservedAt, /invalid observedAt timestamp/i);
  });

  it("accepts live evidence with a valid UTC timestamp without fractional seconds", async () => {
    const binding = await approvedBinding();
    const evidence = binding.evidence.map((record) => ({
      ...record,
      provenance: { ...record.provenance, freshness: "live" as const, observedAt: "2026-08-28T00:00:00Z" },
    }));
    const payloadDigest = await digestApprovalPayload({ target: binding.approval.target, copy: binding.representation.copy, evidence });
    await expect(previewShopifyProductUpdate({
      approval: { ...binding.approval, payloadDigest },
      representation: { ...binding.representation, payloadDigest },
      evidence,
    })).resolves.toMatchObject({ status: "preview_ready", payloadDigest });
  });

  it("rejects a non-Shopify approval target or complete-but-empty copy", async () => {
    const binding = await approvedBinding();
    await expect(previewShopifyProductUpdate({
      ...binding,
      approval: { ...binding.approval, target: { ...binding.approval.target, provider: "fixture" } },
    })).rejects.toThrow(/Shopify product identity/i);

    const blank = await approvedBinding({ title: " ", description: "Description", bullets: [] });
    await expect(previewShopifyProductUpdate(blank)).rejects.toThrow(/non-empty/i);
  });
});
