import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  submissionClaimsFromCapabilities,
  validateSubmissionManifest,
  validateSubmissionRepository,
} from "../../scripts/submission-readiness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function validManifest() {
  const capabilities = {
    webmcpApprovalTool: false,
    webmcpResetTool: false,
    liveShopifyWrite: false,
    adsSftpUpload: false,
    adsApiWrite: false,
    adsActivation: false,
    adsSpend: false,
    authenticatedMerchantAuthority: false,
    checkoutStarted: false,
    paymentAttempted: false,
  };
  return {
    schemaVersion: "conversion-lab.submission.v1",
    productName: "Conversion Lab",
    tagline: "A sufficiently specific agent conversion readiness proposition.",
    liveUrl: "https://conversion-lab-webmcp.vercel.app/",
    repositoryUrl: "https://github.com/DG-creative-lab/openai-webmcp-hackathon",
    license: "MIT",
    siteToolCount: 10,
    video: { maximumSeconds: 180, plannedSeconds: 165, publicUrl: null },
    capabilities,
    claims: submissionClaimsFromCapabilities(capabilities),
    externalAcceptance: Object.fromEntries([
      "scriptedPublicJourney",
      "nativeChatgptWebmcpJourney",
      "secondCleanSession",
      "publicVideo",
      "devpostSubmission",
    ].map((key) => [key, { status: "pending", evidence: null }])),
  };
}

function completeAcceptedManifest() {
  const manifest = validManifest();
  manifest.video.publicUrl = "https://www.youtube.com/watch?v=aB3dE5fG7hI";
  manifest.externalAcceptance = {
    scriptedPublicJourney: {
      status: "passed",
      evidence: {
        kind: "scripted_public_journey",
        runDate: "2026-08-29",
        appUrl: manifest.liveUrl,
        runner: "playwright",
        modelContextMode: "injected_test_host",
        passedTests: 1,
        totalTests: 1,
      },
    },
    nativeChatgptWebmcpJourney: {
      status: "passed",
      evidence: {
        kind: "native_chatgpt_webmcp_journey",
        runDate: "2026-08-29",
        appUrl: manifest.liveUrl,
        host: "chatgpt_in_app_browser",
        modelContextMode: "native",
        discoveredToolCount: manifest.siteToolCount,
        journeyCompleted: true,
        evidenceUrl: "https://github.com/DG-creative-lab/openai-webmcp-hackathon/issues/1",
      },
    },
    secondCleanSession: {
      status: "passed",
      evidence: {
        kind: "second_clean_session",
        runDate: "2026-08-29",
        appUrl: manifest.liveUrl,
        host: "chrome_webmcp",
        cleanSession: true,
        journeyCompleted: true,
        evidenceUrl: "https://github.com/DG-creative-lab/openai-webmcp-hackathon/actions/runs/33299008257",
      },
    },
    publicVideo: {
      status: "passed",
      evidence: {
        kind: "public_demo_video",
        publishedAt: "2026-08-29",
        provider: "youtube",
        url: manifest.video.publicUrl,
        durationSeconds: 165,
        hasAudio: true,
      },
    },
    devpostSubmission: {
      status: "passed",
      evidence: {
        kind: "devpost_submission_receipt",
        submittedAt: "2026-08-29",
        submissionUrl: "https://devpost.com/software/conversion-lab",
        confirmationId: "confirm-123",
      },
    },
  };
  return manifest;
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

  it("rejects unsafe URLs and enabled external capabilities even when prose is regenerated", () => {
    const manifest = validManifest();
    manifest.liveUrl = "http://user:secret@example.com";
    manifest.capabilities.liveShopifyWrite = true;
    manifest.capabilities.adsActivation = true;
    manifest.claims = submissionClaimsFromCapabilities(manifest.capabilities);
    const errors = validateSubmissionManifest(manifest);
    assert.ok(errors.includes("manifest:liveUrl"));
    assert.ok(errors.includes("manifest:capabilities.liveShopifyWrite"));
    assert.ok(errors.includes("manifest:capabilities.adsActivation"));
  });

  it("rejects contradictory safety prose instead of accepting required substrings", () => {
    const manifest = validManifest();
    manifest.claims = {
      webmcp: "It is false that approval and reset are absent from the site-tool surface.",
      shopify: "The statement no live Shopify write is false; production writes are enabled.",
      openaiAds: "The claim no SFTP upload, Ads API write, activation, or spend is false.",
      approval: "It is no longer true that this is not authenticated merchant authority.",
    };
    assert.deepEqual(validateSubmissionManifest(manifest).filter((error) => error.startsWith("manifest:claims.")), [
      "manifest:claims.webmcp",
      "manifest:claims.shopify",
      "manifest:claims.openaiAds",
      "manifest:claims.approval",
    ]);
  });

  it("requires evidence before an external checkpoint can be marked passed", () => {
    const manifest = validManifest();
    manifest.externalAcceptance.nativeChatgptWebmcpJourney = { status: "passed", evidence: null };
    assert.ok(validateSubmissionManifest(manifest).includes(
      "manifest:externalAcceptance.nativeChatgptWebmcpJourney.evidence",
    ));
  });

  it("rejects arbitrary strings for every passed external checkpoint", () => {
    const manifest = validManifest();
    for (const key of Object.keys(manifest.externalAcceptance)) {
      manifest.externalAcceptance[key] = { status: "passed", evidence: "abcdefghij" };
    }
    manifest.video.publicUrl = "https://example.com/not-necessarily-a-video";
    const errors = validateSubmissionManifest(manifest);
    for (const key of Object.keys(manifest.externalAcceptance)) {
      assert.ok(errors.some((error) => error.startsWith(`manifest:externalAcceptance.${key}.evidence`)));
    }
  });

  it("requires typed YouTube video evidence related to the manifest URL", () => {
    const manifest = validManifest();
    manifest.video.publicUrl = "https://youtu.be/aB3dE5fG7hI";
    manifest.externalAcceptance.publicVideo = {
      status: "passed",
      evidence: {
        kind: "public_demo_video",
        publishedAt: "2026-08-29",
        provider: "youtube",
        url: manifest.video.publicUrl,
        durationSeconds: 165,
        hasAudio: true,
      },
    };
    assert.deepEqual(validateSubmissionManifest(manifest), []);

    manifest.externalAcceptance.publicVideo.evidence.url = "https://example.com/not-a-video";
    assert.ok(validateSubmissionManifest(manifest).includes("manifest:externalAcceptance.publicVideo.evidence.url"));
  });

  it("accepts complete checkpoint-specific evidence with cross-field relationships", () => {
    const manifest = completeAcceptedManifest();
    assert.deepEqual(validateSubmissionManifest(manifest), []);

    manifest.externalAcceptance.nativeChatgptWebmcpJourney.evidence.evidenceUrl = "https://example.com/unverifiable";
    assert.ok(validateSubmissionManifest(manifest).includes(
      "manifest:externalAcceptance.nativeChatgptWebmcpJourney.evidence.evidenceUrl",
    ));
  });

  it("rejects provider homepages in every external resource field", () => {
    const manifest = completeAcceptedManifest();
    manifest.video.publicUrl = "https://youtube.com/";
    manifest.externalAcceptance.nativeChatgptWebmcpJourney.evidence.evidenceUrl = "https://github.com/";
    manifest.externalAcceptance.secondCleanSession.evidence.evidenceUrl = "https://github.com/";
    manifest.externalAcceptance.publicVideo.evidence.url = "https://youtube.com/";
    manifest.externalAcceptance.devpostSubmission.evidence.submissionUrl = "https://devpost.com/";
    manifest.externalAcceptance.devpostSubmission.evidence.confirmationId = "abcdef";

    const errors = validateSubmissionManifest(manifest);
    assert.ok(errors.includes("manifest:externalAcceptance.nativeChatgptWebmcpJourney.evidence.evidenceUrl"));
    assert.ok(errors.includes("manifest:externalAcceptance.secondCleanSession.evidence.evidenceUrl"));
    assert.ok(errors.includes("manifest:externalAcceptance.publicVideo.evidence.url"));
    assert.ok(errors.includes("manifest:externalAcceptance.devpostSubmission.evidence.submissionUrl"));
  });

  it("rejects future dates for every passed checkpoint", () => {
    const manifest = completeAcceptedManifest();
    manifest.externalAcceptance.scriptedPublicJourney.evidence.runDate = "2099-01-01";
    manifest.externalAcceptance.nativeChatgptWebmcpJourney.evidence.runDate = "2099-01-01";
    manifest.externalAcceptance.secondCleanSession.evidence.runDate = "2099-01-01";
    manifest.externalAcceptance.publicVideo.evidence.publishedAt = "2099-01-01";
    manifest.externalAcceptance.devpostSubmission.evidence.submittedAt = "2099-01-01";

    const errors = validateSubmissionManifest(manifest, { now: new Date("2026-08-30T12:00:00.000Z") });
    assert.ok(errors.includes("manifest:externalAcceptance.scriptedPublicJourney.evidence.runDate"));
    assert.ok(errors.includes("manifest:externalAcceptance.nativeChatgptWebmcpJourney.evidence.runDate"));
    assert.ok(errors.includes("manifest:externalAcceptance.secondCleanSession.evidence.runDate"));
    assert.ok(errors.includes("manifest:externalAcceptance.publicVideo.evidence.publishedAt"));
    assert.ok(errors.includes("manifest:externalAcceptance.devpostSubmission.evidence.submittedAt"));
  });
});
