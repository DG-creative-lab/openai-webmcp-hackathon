import { beforeEach, describe, expect, it } from "vitest";
import { appStore } from "./appStore";

describe("demo lifecycle boundary", () => {
  beforeEach(() => appStore.reset());

  it("starts from the generic baseline and requires a draft before evaluation", () => {
    expect(appStore.getState().variant).toMatchObject({
      title: "Modular Commuter Pack",
      status: "baseline",
    });
    expect(appStore.getState().commerce).toMatchObject({
      mode: "fixture",
      contractVersion: "conversion-lab.commerce.v1",
      sourceIdentity: { provider: "shopify", storeId: "fieldwork-demo.myshopify.com", productId: "gid://shopify/Product/108828309" },
      readReceipt: { status: "simulated", externalEffect: false },
      readPreview: { operation: "read_product", externalWrite: false },
      updatePreview: null,
    });
    expect(() => appStore.runEvaluation("Agent")).toThrow(/create an evidence-led draft/i);
    expect(appStore.getState().evidence[0]).toMatchObject({
      contractVersion: "conversion-lab.commerce.v1",
      productIdentity: { provider: "shopify", productId: "gid://shopify/Product/108828309" },
      provenance: { observedAt: expect.any(String), freshness: "fixture" },
    });
  });

  it("blocks publication before exact digest-bound approval state", () => {
    expect(() => appStore.publishVariant("Agent")).toThrow(/approval/i);
  });

  it("supports the draft → test → stage → approve → publish lifecycle", () => {
    appStore.generateVariant("Agent");
    expect(appStore.runEvaluation("Agent").score).toBe(8);
    expect(appStore.stageVariant("Agent").status).toBe("staged");
    const approved = appStore.recordVisibleApproval();
    expect(approved.approvedDigest).toMatch(/^fnv1a-/);
    expect(approved.approval).toMatchObject({
      target: approved.productIdentity,
      payloadDigest: approved.approvedDigest,
      evidenceIds: approved.evidenceIds,
      assurance: "demo_ui_gesture",
    });
    const published = appStore.publishVariant("Agent");
    expect(published.status).toBe("published");
    expect(appStore.getState().commerce.updatePreview).toMatchObject({
      operation: "update_product",
      payloadDigest: published.approvedDigest,
      externalWrite: false,
      payload: {
        variables: { product: { id: "gid://shopify/Product/108828309", title: published.title, descriptionHtml: published.description } },
        requiredScopes: ["write_products"],
        execution: "blocked_preview",
      },
    });
  });

  it("prepares paid media only as a paused, zero-authority projection", () => {
    expect(() => appStore.prepareAds("Agent")).toThrow(/approved variant/i);
    appStore.generateVariant("Agent");
    appStore.runEvaluation("Agent");
    appStore.stageVariant("Agent");
    appStore.recordVisibleApproval();
    appStore.publishVariant("Agent");
    const packageResult = appStore.prepareAds("Agent");
    expect(packageResult.campaignStatus).toBe("PAUSED");
    expect(packageResult.disclaimer).toMatch(/No Ads API call/);
    expect(packageResult.feed).toMatchObject({ identifier_exists: "no", is_ads_eligible: true });
    expect(packageResult.validation).toMatchObject({ scope: "local_schema", valid: true, errors: [] });
    expect(packageResult.validation?.unverified).toContain("The row is accepted during OpenAI feed processing");
  });

  it("resets every mutable workflow surface to the canonical demo baseline", () => {
    appStore.setWebmcpAvailable(true);
    appStore.generateVariant("Agent");
    appStore.runEvaluation("Agent");
    appStore.stageVariant("Agent");
    appStore.recordVisibleApproval();
    appStore.publishVariant("Agent");
    appStore.prepareAds("Agent");
    appStore.updateCart(3, "Agent");
    appStore.setSurface("storefront");

    const resetState = appStore.reset();

    expect(resetState.surface).toBe("studio");
    expect(resetState.variant).toMatchObject({
      title: "Modular Commuter Pack",
      status: "baseline",
      approvedDigest: null,
      approvedAt: null,
      publishedAt: null,
    });
    expect(resetState.variantEvaluation).toBeNull();
    expect(resetState.commerce.updatePreview).toBeNull();
    expect(resetState.adsPackage).toMatchObject({
      status: "not_prepared",
      campaignStatus: "not_created",
      feed: null,
      validation: null,
      adTemplate: null,
    });
    expect(resetState.cartQuantity).toBe(0);
    expect(resetState.webmcpAvailable).toBe(true);
    expect(resetState.activities).toHaveLength(1);
    expect(resetState.activities[0]).toMatchObject({ actor: "Browser user", action: "Demo reset" });
    expect(() => appStore.publishVariant("Agent")).toThrow(/approval/i);
    expect(() => appStore.prepareAds("Agent")).toThrow(/approved variant/i);
  });

  it("is semantically idempotent when the browser user resets repeatedly", () => {
    const first = appStore.reset();
    const second = appStore.reset();
    const semanticSnapshot = (current: typeof first) => ({
      surface: current.surface,
      variant: current.variant,
      evaluation: current.variantEvaluation,
      commerce: current.commerce,
      ads: current.adsPackage,
      cart: current.cartQuantity,
      activity: current.activities[0]?.action,
    });

    expect(semanticSnapshot(second)).toEqual(semanticSnapshot(first));
  });

  it("notifies active subscribers and stops after unsubscribe", () => {
    let notifications = 0;
    const unsubscribe = appStore.subscribe(() => {
      notifications += 1;
    });

    appStore.setSurface("storefront");
    expect(notifications).toBe(1);

    unsubscribe();
    appStore.setSurface("studio");
    expect(notifications).toBe(1);
  });
});
