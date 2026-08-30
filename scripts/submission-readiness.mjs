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

export function validateSubmissionManifest(value) {
  const errors = [];
  const manifest = record(value);
  if (!manifest) return ["manifest:root"];

  if (manifest.schemaVersion !== "conversion-lab.submission.v1") errors.push("manifest:schemaVersion");
  if (manifest.productName !== "Conversion Lab") errors.push("manifest:productName");
  if (typeof manifest.tagline !== "string" || manifest.tagline.trim().length < 20) errors.push("manifest:tagline");
  if (!isSafeHttpsUrl(manifest.liveUrl)) errors.push("manifest:liveUrl");
  if (!isSafeHttpsUrl(manifest.repositoryUrl)) errors.push("manifest:repositoryUrl");
  if (manifest.license !== "MIT") errors.push("manifest:license");
  if (manifest.siteToolCount !== 9) errors.push("manifest:siteToolCount");

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

  const claims = record(manifest.claims);
  const claimRules = {
    webmcp: /approval and reset are absent/i,
    shopify: /no live Shopify write/i,
    openaiAds: /no SFTP upload, Ads API write, activation, or spend/i,
    approval: /not authenticated merchant authority/i,
  };
  for (const [claim, expected] of Object.entries(claimRules)) {
    if (typeof claims?.[claim] !== "string" || !expected.test(claims[claim])) errors.push(`manifest:claims.${claim}`);
  }

  const acceptance = record(manifest.externalAcceptance);
  if (!acceptance) {
    errors.push("manifest:externalAcceptance");
  } else {
    const unexpected = Object.keys(acceptance).filter((key) => !requiredAcceptance.includes(key));
    if (unexpected.length > 0) errors.push(`manifest:externalAcceptance.unexpected:${unexpected.join(",")}`);
    for (const key of requiredAcceptance) {
      const item = record(acceptance[key]);
      if (!item || (item.status !== "pending" && item.status !== "passed")) {
        errors.push(`manifest:externalAcceptance.${key}.status`);
        continue;
      }
      if (item.status === "pending" && item.evidence !== null) errors.push(`manifest:externalAcceptance.${key}.pendingEvidence`);
      if (item.status === "passed" && (typeof item.evidence !== "string" || item.evidence.trim().length < 10)) {
        errors.push(`manifest:externalAcceptance.${key}.passedEvidence`);
      }
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
