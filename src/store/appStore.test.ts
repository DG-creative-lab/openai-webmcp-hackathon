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
});
