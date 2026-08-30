import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const requiredAcceptance = [
  "scriptedPublicJourney",
  "nativeChatgptWebmcpJourney",
  "secondCleanSession",
  "publicVideo",
  "devpostSubmission",
];

const requiredCapabilityFacts = {
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

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isSafeHttpsUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function safeUrl(value) {
  if (!isSafeHttpsUrl(value)) return null;
  return new URL(value);
}

function isYouTubeVideoUrl(value) {
  const url = safeUrl(value);
  if (!url) return false;
  const hostname = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const videoId = hostname === "youtu.be" && parts.length === 1
    ? parts[0]
    : (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) && url.pathname === "/watch"
      ? url.searchParams.get("v")
      : (hostname === "youtube.com" || hostname.endsWith(".youtube.com"))
        && parts.length === 2
        && ["shorts", "embed"].includes(parts[0])
        ? parts[1]
        : null;
  return typeof videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(videoId);
}

function isGitHubEvidenceResourceUrl(value) {
  const url = safeUrl(value);
  if (!url || url.hostname.toLowerCase() !== "github.com") return false;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 4 && parts[2] === "issues") {
    return parts[0].length > 0 && parts[1].length > 0 && /^\d+$/.test(parts[3]);
  }
  if (parts.length === 5 && parts[2] === "actions" && parts[3] === "runs") {
    return parts[0].length > 0 && parts[1].length > 0 && /^\d+$/.test(parts[4]);
  }
  return parts.length === 7
    && parts[2] === "actions"
    && parts[3] === "runs"
    && /^\d+$/.test(parts[4])
    && ["job", "artifacts"].includes(parts[5])
    && /^\d+$/.test(parts[6]);
}

function isAuditableJourneyEvidenceUrl(value) {
  return isGitHubEvidenceResourceUrl(value) || isYouTubeVideoUrl(value);
}

function isDevpostSubmissionUrl(value) {
  const url = safeUrl(value);
  if (!url || (url.hostname.toLowerCase() !== "devpost.com" && !url.hostname.toLowerCase().endsWith(".devpost.com"))) {
    return false;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "software" && /^[a-z0-9][a-z0-9-]*$/i.test(parts[1]);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isCompletionDate(value, todayUtc) {
  return isIsoDate(value) && value <= todayUtc;
}

function validateExactKeys(errors, prefix, value, expectedKeys) {
  const actual = record(value);
  if (!actual) {
    errors.push(prefix);
    return null;
  }
  const unexpected = Object.keys(actual).filter((key) => !expectedKeys.includes(key));
  const missing = expectedKeys.filter((key) => !Object.hasOwn(actual, key));
  if (unexpected.length > 0) errors.push(`${prefix}.unexpected:${unexpected.join(",")}`);
  if (missing.length > 0) errors.push(`${prefix}.missing:${missing.join(",")}`);
  return actual;
}

export function submissionClaimsFromCapabilities(value) {
  const capabilities = record(value) ?? {};
  return {
    webmcp: capabilities.webmcpApprovalTool === false && capabilities.webmcpResetTool === false
      ? "Ten page-scoped tools share the visible browser workspace; approval and reset are absent from the site-tool surface."
      : "The WebMCP surface may expose approval or reset authority.",
    shopify: capabilities.liveShopifyWrite === false
      ? "The public demo uses a deterministic fixture, with an optional server-side Shopify read adapter and a blocked productUpdate preview; it performs no live Shopify write."
      : "The public demo may perform live Shopify writes.",
    openaiAds: capabilities.adsSftpUpload === false
      && capabilities.adsApiWrite === false
      && capabilities.adsActivation === false
      && capabilities.adsSpend === false
      ? "The demo exports a locally validated Google-compatible CSV and PAUSED paid projection; it performs no SFTP upload, Ads API write, activation, or spend."
      : "The demo may upload feeds, write through the Ads API, activate campaigns, or spend money.",
    approval: capabilities.authenticatedMerchantAuthority === false
      ? "The visible approval is a digest-bound credential-free demo gesture, not authenticated merchant authority."
      : "The visible approval is backed by authenticated merchant authority.",
  };
}

function validateCapabilityFacts(manifest, errors) {
  const capabilities = validateExactKeys(
    errors,
    "manifest:capabilities",
    manifest.capabilities,
    Object.keys(requiredCapabilityFacts),
  );
  if (!capabilities) return;
  for (const [key, requiredValue] of Object.entries(requiredCapabilityFacts)) {
    if (capabilities[key] !== requiredValue) errors.push(`manifest:capabilities.${key}`);
  }

  const claims = validateExactKeys(
    errors,
    "manifest:claims",
    manifest.claims,
    ["webmcp", "shopify", "openaiAds", "approval"],
  );
  if (!claims) return;
  const expectedClaims = submissionClaimsFromCapabilities(capabilities);
  for (const [key, expected] of Object.entries(expectedClaims)) {
    if (claims[key] !== expected) errors.push(`manifest:claims.${key}`);
  }
}

function validateJourneyEvidence(key, evidence, manifest, errors, expected, todayUtc) {
  const prefix = `manifest:externalAcceptance.${key}.evidence`;
  const value = validateExactKeys(errors, prefix, evidence, expected.keys);
  if (!value) return;
  if (value.kind !== expected.kind) errors.push(`${prefix}.kind`);
  if (!isCompletionDate(value.runDate, todayUtc)) errors.push(`${prefix}.runDate`);
  if (value.appUrl !== manifest.liveUrl) errors.push(`${prefix}.appUrl`);
  expected.validate(value, prefix, errors);
}

function validateAcceptanceEvidence(key, evidence, manifest, errors, todayUtc) {
  if (key === "scriptedPublicJourney") {
    validateJourneyEvidence(key, evidence, manifest, errors, {
      kind: "scripted_public_journey",
      keys: ["kind", "runDate", "appUrl", "runner", "modelContextMode", "passedTests", "totalTests"],
      validate(value, prefix, target) {
        if (value.runner !== "playwright") target.push(`${prefix}.runner`);
        if (value.modelContextMode !== "injected_test_host") target.push(`${prefix}.modelContextMode`);
        if (!Number.isInteger(value.totalTests) || value.totalTests < 1) target.push(`${prefix}.totalTests`);
        if (!Number.isInteger(value.passedTests) || value.passedTests !== value.totalTests) target.push(`${prefix}.passedTests`);
      },
    }, todayUtc);
    return;
  }
  if (key === "nativeChatgptWebmcpJourney") {
    validateJourneyEvidence(key, evidence, manifest, errors, {
      kind: "native_chatgpt_webmcp_journey",
      keys: ["kind", "runDate", "appUrl", "host", "modelContextMode", "discoveredToolCount", "journeyCompleted", "evidenceUrl"],
      validate(value, prefix, target) {
        if (value.host !== "chatgpt_in_app_browser") target.push(`${prefix}.host`);
        if (value.modelContextMode !== "native") target.push(`${prefix}.modelContextMode`);
        if (value.discoveredToolCount !== manifest.siteToolCount) target.push(`${prefix}.discoveredToolCount`);
        if (value.journeyCompleted !== true) target.push(`${prefix}.journeyCompleted`);
        if (!isAuditableJourneyEvidenceUrl(value.evidenceUrl)) target.push(`${prefix}.evidenceUrl`);
      },
    }, todayUtc);
    return;
  }
  if (key === "secondCleanSession") {
    validateJourneyEvidence(key, evidence, manifest, errors, {
      kind: "second_clean_session",
      keys: ["kind", "runDate", "appUrl", "host", "cleanSession", "journeyCompleted", "evidenceUrl"],
      validate(value, prefix, target) {
        if (value.host !== "chatgpt_in_app_browser" && value.host !== "chrome_webmcp") target.push(`${prefix}.host`);
        if (value.cleanSession !== true) target.push(`${prefix}.cleanSession`);
        if (value.journeyCompleted !== true) target.push(`${prefix}.journeyCompleted`);
        if (!isAuditableJourneyEvidenceUrl(value.evidenceUrl)) target.push(`${prefix}.evidenceUrl`);
      },
    }, todayUtc);
    return;
  }
  if (key === "publicVideo") {
    const prefix = `manifest:externalAcceptance.${key}.evidence`;
    const value = validateExactKeys(errors, prefix, evidence, ["kind", "publishedAt", "provider", "url", "durationSeconds", "hasAudio"]);
    if (!value) return;
    if (value.kind !== "public_demo_video") errors.push(`${prefix}.kind`);
    if (!isCompletionDate(value.publishedAt, todayUtc)) errors.push(`${prefix}.publishedAt`);
    if (value.provider !== "youtube") errors.push(`${prefix}.provider`);
    if (!isYouTubeVideoUrl(value.url)) errors.push(`${prefix}.url`);
    if (value.url !== manifest.video?.publicUrl) errors.push(`${prefix}.urlMismatch`);
    if (!Number.isInteger(value.durationSeconds) || value.durationSeconds < 1 || value.durationSeconds > manifest.video?.maximumSeconds) {
      errors.push(`${prefix}.durationSeconds`);
    }
    if (value.hasAudio !== true) errors.push(`${prefix}.hasAudio`);
    return;
  }
  if (key === "devpostSubmission") {
    const prefix = `manifest:externalAcceptance.${key}.evidence`;
    const value = validateExactKeys(errors, prefix, evidence, ["kind", "submittedAt", "submissionUrl", "confirmationId"]);
    if (!value) return;
    if (value.kind !== "devpost_submission_receipt") errors.push(`${prefix}.kind`);
    if (!isCompletionDate(value.submittedAt, todayUtc)) errors.push(`${prefix}.submittedAt`);
    if (!isDevpostSubmissionUrl(value.submissionUrl)) errors.push(`${prefix}.submissionUrl`);
    if (typeof value.confirmationId !== "string" || value.confirmationId.trim().length < 6) errors.push(`${prefix}.confirmationId`);
  }
}

export function validateSubmissionManifest(value, { now = new Date() } = {}) {
  const errors = [];
  const manifest = record(value);
  if (!manifest) return ["manifest:root"];
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return ["validator:now"];
  const todayUtc = now.toISOString().slice(0, 10);

  if (manifest.schemaVersion !== "conversion-lab.submission.v1") errors.push("manifest:schemaVersion");
  if (manifest.productName !== "Conversion Lab") errors.push("manifest:productName");
  if (typeof manifest.tagline !== "string" || manifest.tagline.trim().length < 20) errors.push("manifest:tagline");
  if (!isSafeHttpsUrl(manifest.liveUrl)) errors.push("manifest:liveUrl");
  if (!isSafeHttpsUrl(manifest.repositoryUrl)) errors.push("manifest:repositoryUrl");
  if (manifest.license !== "MIT") errors.push("manifest:license");
  if (manifest.siteToolCount !== 10) errors.push("manifest:siteToolCount");

  const video = record(manifest.video);
  if (!video) {
    errors.push("manifest:video");
  } else {
    if (!Number.isInteger(video.maximumSeconds) || video.maximumSeconds !== 180) errors.push("manifest:video.maximumSeconds");
    if (!Number.isInteger(video.plannedSeconds) || video.plannedSeconds <= 0 || video.plannedSeconds > video.maximumSeconds) {
      errors.push("manifest:video.plannedSeconds");
    }
    if (video.publicUrl !== null && !isSafeHttpsUrl(video.publicUrl)) errors.push("manifest:video.publicUrl");
  }

  validateCapabilityFacts(manifest, errors);

  const acceptance = record(manifest.externalAcceptance);
  if (!acceptance) {
    errors.push("manifest:externalAcceptance");
  } else {
    const unexpected = Object.keys(acceptance).filter((key) => !requiredAcceptance.includes(key));
    if (unexpected.length > 0) errors.push(`manifest:externalAcceptance.unexpected:${unexpected.join(",")}`);
    for (const key of requiredAcceptance) {
      const item = validateExactKeys(
        errors,
        `manifest:externalAcceptance.${key}`,
        acceptance[key],
        ["status", "evidence"],
      );
      if (!item || (item.status !== "pending" && item.status !== "passed")) {
        errors.push(`manifest:externalAcceptance.${key}.status`);
        continue;
      }
      if (item.status === "pending" && item.evidence !== null) errors.push(`manifest:externalAcceptance.${key}.pendingEvidence`);
      if (item.status === "passed") validateAcceptanceEvidence(key, item.evidence, manifest, errors, todayUtc);
    }
  }

  if (video && acceptance) {
    const publicVideo = record(acceptance.publicVideo);
    if (publicVideo?.status === "passed" && !isSafeHttpsUrl(video.publicUrl)) errors.push("manifest:publicVideo.urlRequired");
    if (publicVideo?.status === "pending" && video.publicUrl !== null) errors.push("manifest:publicVideo.pendingUrl");
  }

  return errors;
}

export async function validateSubmissionRepository(root) {
  const manifestPath = path.join(root, "docs", "submission-manifest.json");
  const [manifestText, submission, readme, license] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(path.join(root, "docs", "SUBMISSION.md"), "utf8"),
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(root, "LICENSE"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const errors = validateSubmissionManifest(manifest);

  const requiredSubmissionText = [
    "https://conversion-lab-webmcp.vercel.app/",
    "https://github.com/DG-creative-lab/openai-webmcp-hackathon",
    "## 165-second video storyboard",
    "Passing repository CI does not complete these external items.",
  ];
  for (const text of requiredSubmissionText) {
    if (!submission.includes(text)) errors.push(`submission:missing:${text}`);
  }
  const liveUrlWithoutTrailingSlash = manifest.liveUrl.replace(/\/$/, "");
  if (!readme.includes(manifest.liveUrl) && !readme.includes(liveUrlWithoutTrailingSlash)) errors.push("readme:liveUrl");
  if (!/MIT License/.test(license)) errors.push("license:MIT");

  return { manifest, errors };
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(scriptDirectory, "..");
  const { manifest, errors } = await validateSubmissionRepository(root);
  if (errors.length > 0) {
    console.error(`Submission repository check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  const pending = Object.entries(manifest.externalAcceptance)
    .filter(([, item]) => item.status === "pending")
    .map(([key]) => key);
  console.log(`Submission repository artifacts are valid. External checkpoints pending: ${pending.join(", ") || "none"}.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
