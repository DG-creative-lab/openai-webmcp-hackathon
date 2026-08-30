import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateSubmissionManifest, validateSubmissionRepository } from "../../scripts/submission-readiness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function validManifest() {
  return {
    schemaVersion: "conversion-lab.submission.v1",
    productName: "Conversion Lab",
    tagline: "A sufficiently specific agent conversion readiness proposition.",
    liveUrl: "https://conversion-lab-webmcp.vercel.app/",
    repositoryUrl: "https://github.com/DG-creative-lab/openai-webmcp-hackathon",
    license: "MIT",
    siteToolCount: 9,
    video: { maximumSeconds: 180, plannedSeconds: 165, publicUrl: null },
    claims: {
      webmcp: "Approval and reset are absent from the site-tool surface.",
      shopify: "The demo performs no live Shopify write.",
      openaiAds: "The demo performs no SFTP upload, Ads API write, activation, or spend.",
      approval: "The gesture is not authenticated merchant authority.",
    },
    externalAcceptance: Object.fromEntries([
      "scriptedPublicJourney",
      "nativeChatgptWebmcpJourney",
      "secondCleanSession",
      "publicVideo",
      "devpostSubmission",
    ].map((key) => [key, { status: "pending", evidence: null }])),
  };
}

describe("submission readiness contract", () => {
  it("validates the repository submission pack without treating external checkpoints as complete", async () => {
    const { manifest, errors } = await validateSubmissionRepository(root);
    assert.deepEqual(errors, []);
    assert.equal(manifest.externalAcceptance.nativeChatgptWebmcpJourney.status, "pending");
    assert.equal(manifest.externalAcceptance.publicVideo.status, "pending");
  });

  it("rejects a video plan that exceeds the three-minute limit", () => {
    const manifest = validManifest();
    manifest.video.plannedSeconds = 181;
    assert.ok(validateSubmissionManifest(manifest).includes("manifest:video.plannedSeconds"));
  });

  it("rejects unsafe URLs and unsupported live-effect claims", () => {
    const manifest = validManifest();
    manifest.liveUrl = "http://user:secret@example.com";
    manifest.claims.shopify = "The app writes products live.";
    manifest.claims.openaiAds = "The app activates paid campaigns.";
    assert.deepEqual(validateSubmissionManifest(manifest), [
      "manifest:liveUrl",
      "manifest:claims.shopify",
      "manifest:claims.openaiAds",
    ]);
  });

  it("requires evidence before an external checkpoint can be marked passed", () => {
    const manifest = validManifest();
    manifest.externalAcceptance.nativeChatgptWebmcpJourney = { status: "passed", evidence: null };
    assert.ok(validateSubmissionManifest(manifest).includes(
      "manifest:externalAcceptance.nativeChatgptWebmcpJourney.passedEvidence",
    ));
  });

  it("requires a public video URL only when video acceptance is passed", () => {
    const manifest = validManifest();
    manifest.externalAcceptance.publicVideo = { status: "passed", evidence: "Published with audible narration" };
    assert.ok(validateSubmissionManifest(manifest).includes("manifest:publicVideo.urlRequired"));
    manifest.video.publicUrl = "https://video.example/conversion-lab";
    assert.deepEqual(validateSubmissionManifest(manifest), []);
  });
});
