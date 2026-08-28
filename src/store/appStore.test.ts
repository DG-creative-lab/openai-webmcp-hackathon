import { beforeEach, describe, expect, it } from "vitest";
import { appStore } from "./appStore";

describe("merchant authority boundary", () => {
  beforeEach(() => appStore.reset());

  it("blocks publication before exact merchant approval", () => {
    expect(() => appStore.publishVariant("Agent")).toThrow(/approval/i);
  });

  it("supports the draft → test → stage → approve → publish lifecycle", () => {
    appStore.generateVariant("Agent");
    expect(appStore.runEvaluation("Agent").score).toBe(8);
    expect(appStore.stageVariant("Agent").status).toBe("staged");
    expect(appStore.approveVariant().approvedDigest).toMatch(/^fnv1a-/);
    expect(appStore.publishVariant("Agent").status).toBe("published");
  });

  it("prepares paid media only as a paused, zero-authority projection", () => {
    expect(() => appStore.prepareAds("Agent")).toThrow(/approved variant/i);
    appStore.generateVariant("Agent");
    appStore.runEvaluation("Agent");
    appStore.stageVariant("Agent");
    appStore.approveVariant();
    appStore.publishVariant("Agent");
    const packageResult = appStore.prepareAds("Agent");
    expect(packageResult.campaignStatus).toBe("PAUSED");
    expect(packageResult.disclaimer).toMatch(/No Ads API call/);
  });

  it("resets every mutable workflow surface to the canonical merchant baseline", () => {
    appStore.setWebmcpAvailable(true);
    appStore.generateVariant("Agent");
    appStore.runEvaluation("Agent");
    appStore.stageVariant("Agent");
    appStore.approveVariant();
    appStore.publishVariant("Agent");
    appStore.prepareAds("Agent");
    appStore.updateCart(3, "Agent");
    appStore.setSurface("storefront");

    const resetState = appStore.reset();

    expect(resetState.surface).toBe("studio");
    expect(resetState.variant).toMatchObject({
      title: "24L Waterproof Commuter Backpack + Pannier",
      status: "draft",
      approvedDigest: null,
      approvedAt: null,
      publishedAt: null,
    });
    expect(resetState.variantEvaluation).toBeNull();
    expect(resetState.adsPackage).toMatchObject({
      status: "not_prepared",
      campaignStatus: "not_created",
      feed: null,
      adTemplate: null,
    });
    expect(resetState.cartQuantity).toBe(0);
    expect(resetState.webmcpAvailable).toBe(true);
    expect(resetState.activities).toHaveLength(1);
    expect(resetState.activities[0]).toMatchObject({ actor: "Merchant", action: "Demo reset" });
    expect(() => appStore.publishVariant("Agent")).toThrow(/approval/i);
    expect(() => appStore.prepareAds("Agent")).toThrow(/approved variant/i);
  });

  it("is semantically idempotent when the merchant resets repeatedly", () => {
    const first = appStore.reset();
    const second = appStore.reset();
    const semanticSnapshot = (current: typeof first) => ({
      surface: current.surface,
      variant: current.variant,
      evaluation: current.variantEvaluation,
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
