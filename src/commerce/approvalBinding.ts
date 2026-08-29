import {
  COMMERCE_CONTRACT_VERSION,
  type ApprovalEnvelope,
  type ApprovalProductSnapshot,
  type CommerceCopy,
  type CommerceIdentity,
  type EvidenceRecord,
  type RepresentationVariant,
} from "./contracts";

function sameIdentity(left: Readonly<CommerceIdentity>, right: Readonly<CommerceIdentity>): boolean {
  return left.provider === right.provider && left.storeId === right.storeId && left.productId === right.productId;
}

function canonicalIdentity(identity: Readonly<CommerceIdentity>) {
  return { provider: identity.provider, storeId: identity.storeId, productId: identity.productId };
}

function isCredentialFreeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function canonicalProductSnapshot(value: Readonly<ApprovalProductSnapshot>): ApprovalProductSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("Approval blocked: the feed-bearing product snapshot is missing.");
  }
  if (typeof value.sku !== "string" || !value.sku.trim() || value.sku.length > 100) {
    throw new Error("Approval blocked: the product snapshot SKU is invalid.");
  }
  if (typeof value.brand !== "string" || !value.brand.trim() || value.brand.length > 70) {
    throw new Error("Approval blocked: the product snapshot brand is invalid.");
  }
  const minorUnits = typeof value.price === "number" ? Math.round(value.price * 100) : Number.NaN;
  if (
    typeof value.price !== "number"
    || !Number.isFinite(value.price)
    || value.price <= 0
    || !Number.isSafeInteger(minorUnits)
    || minorUnits / 100 !== value.price
  ) {
    throw new Error("Approval blocked: the product snapshot price is invalid.");
  }
  if (value.currency !== "GBP") {
    throw new Error("Approval blocked: the product snapshot currency is unsupported.");
  }
  if (typeof value.inventory !== "number" || !Number.isInteger(value.inventory) || value.inventory < 0) {
    throw new Error("Approval blocked: the product snapshot inventory is invalid.");
  }
  if (!isCredentialFreeHttpUrl(value.productUrl) || !isCredentialFreeHttpUrl(value.imageUrl)) {
    throw new Error("Approval blocked: the product snapshot URLs are invalid.");
  }
  return {
    sku: value.sku,
    brand: value.brand,
    price: value.price,
    currency: value.currency,
    inventory: value.inventory,
    productUrl: value.productUrl,
    imageUrl: value.imageUrl,
  };
}

function ownedEvidence(record: Readonly<EvidenceRecord>): EvidenceRecord {
  return {
    contractVersion: record.contractVersion,
    productIdentity: canonicalIdentity(record.productIdentity),
    id: record.id,
    label: record.label,
    value: record.value,
    source: record.source,
    verified: record.verified,
    tags: [...record.tags],
    provenance: {
      source: record.provenance.source,
      reference: record.provenance.reference,
      observedAt: record.provenance.observedAt,
      freshness: record.provenance.freshness,
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((nested) => deepFreeze(nested));
    Object.freeze(value);
  }
  return value;
}

function isValidObservedAt(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  const canonical = value.includes(".")
    ? value.replace(/\.(\d{1,3})Z$/, (_match, fraction: string) => `.${fraction.padEnd(3, "0")}Z`)
    : value.replace(/Z$/, ".000Z");
  return new Date(milliseconds).toISOString() === canonical;
}

function hasValidProvenance(record: EvidenceRecord): boolean {
  return Boolean(record.provenance.source && record.provenance.reference)
    && (record.provenance.freshness === "fixture" || record.provenance.freshness === "live")
    && isValidObservedAt(record.provenance.observedAt);
}

export function isEvidenceAuthoritativeForTarget(record: EvidenceRecord, target: Readonly<CommerceIdentity>): boolean {
  return record.contractVersion === COMMERCE_CONTRACT_VERSION
    && sameIdentity(record.productIdentity, target)
    && record.verified
    && hasValidProvenance(record);
}

function evidenceAuthority(record: EvidenceRecord) {
  return {
    contractVersion: record.contractVersion,
    productIdentity: canonicalIdentity(record.productIdentity),
    id: record.id,
    label: record.label,
    value: record.value,
    source: record.source,
    verified: record.verified,
    tags: [...record.tags].sort(),
    provenance: {
      source: record.provenance.source,
      reference: record.provenance.reference,
      observedAt: record.provenance.observedAt,
      freshness: record.provenance.freshness,
    },
  };
}

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256-v1-${hex}`;
}

export function assertEvidenceAuthority(
  evidence: readonly EvidenceRecord[],
  target: Readonly<CommerceIdentity>,
  expectedEvidenceIds: readonly string[],
): void {
  const expectedIds = [...expectedEvidenceIds].sort();
  const actualIds = evidence.map((record) => record.id).sort();
  if (expectedIds.length === 0) {
    throw new Error("Approval blocked: at least one verified evidence record is required.");
  }
  if (new Set(expectedIds).size !== expectedIds.length || new Set(actualIds).size !== actualIds.length) {
    throw new Error("Approval blocked: evidence IDs must be unique.");
  }
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error("Approval blocked: the complete approved evidence set is required.");
  }
  for (const record of evidence) {
    if (record.contractVersion !== COMMERCE_CONTRACT_VERSION) {
      throw new Error(`Approval blocked: evidence ${record.id} has an unsupported contract version.`);
    }
    if (!sameIdentity(record.productIdentity, target)) {
      throw new Error(`Approval blocked: evidence ${record.id} belongs to a different product target.`);
    }
    if (!record.verified) {
      throw new Error(`Approval blocked: evidence ${record.id} is not verified.`);
    }
    if (!record.provenance.source || !record.provenance.reference) {
      throw new Error(`Approval blocked: evidence ${record.id} is missing provenance.`);
    }
    if (record.provenance.freshness !== "fixture" && record.provenance.freshness !== "live") {
      throw new Error(`Approval blocked: evidence ${record.id} has invalid freshness.`);
    }
    if (!isValidObservedAt(record.provenance.observedAt)) {
      throw new Error(`Approval blocked: evidence ${record.id} has an invalid observedAt timestamp.`);
    }
  }
}

export async function digestApprovalPayload(input: {
  target: Readonly<CommerceIdentity>;
  productSnapshot: Readonly<ApprovalProductSnapshot>;
  copy: Readonly<CommerceCopy> & { readonly bullets: readonly string[] };
  evidence: readonly EvidenceRecord[];
}): Promise<string> {
  const canonical = {
    digestVersion: "sha256-v1",
    contractVersion: COMMERCE_CONTRACT_VERSION,
    target: canonicalIdentity(input.target),
    productSnapshot: canonicalProductSnapshot(input.productSnapshot),
    copy: {
      title: input.copy.title,
      description: input.copy.description,
      bullets: [...input.copy.bullets],
    },
    evidence: [...input.evidence]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(evidenceAuthority),
  };
  return hash(JSON.stringify(canonical));
}

export interface ApprovalBindingInput {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
}

export interface VerifiedApprovalBinding extends ApprovalBindingInput {
  readonly payloadDigest: string;
}

function captureApprovalBinding(input: ApprovalBindingInput): ApprovalBindingInput {
  return deepFreeze({
    approval: {
      contractVersion: input.approval.contractVersion,
      assurance: input.approval.assurance,
      principalId: input.approval.principalId,
      target: canonicalIdentity(input.approval.target),
      productSnapshot: canonicalProductSnapshot(input.approval.productSnapshot),
      payloadDigest: input.approval.payloadDigest,
      evidenceIds: [...input.approval.evidenceIds],
      policyVersion: input.approval.policyVersion,
      approvedAt: input.approval.approvedAt,
      expiresAt: input.approval.expiresAt,
    },
    representation: {
      contractVersion: input.representation.contractVersion,
      id: input.representation.id,
      productIdentity: canonicalIdentity(input.representation.productIdentity),
      copy: {
        title: input.representation.copy.title,
        description: input.representation.copy.description,
        bullets: [...input.representation.copy.bullets],
      },
      evidenceIds: [...input.representation.evidenceIds],
      payloadDigest: input.representation.payloadDigest,
      status: input.representation.status,
    },
    evidence: input.evidence.map(ownedEvidence),
  });
}

export async function verifyApprovalBinding(input: ApprovalBindingInput): Promise<VerifiedApprovalBinding> {
  const captured = captureApprovalBinding(input);
  const { approval, representation, evidence } = captured;
  if (approval.contractVersion !== COMMERCE_CONTRACT_VERSION || representation.contractVersion !== COMMERCE_CONTRACT_VERSION) {
    throw new Error("Approval blocked: unsupported commerce contract version.");
  }
  if (!sameIdentity(approval.target, representation.productIdentity)) {
    throw new Error("Approval blocked: the approval and representation target different products.");
  }
  if (JSON.stringify([...approval.evidenceIds].sort()) !== JSON.stringify([...representation.evidenceIds].sort())) {
    throw new Error("Approval blocked: the approval and representation use different evidence sets.");
  }
  assertEvidenceAuthority(evidence, approval.target, approval.evidenceIds);
  const expectedDigest = await digestApprovalPayload({
    target: approval.target,
    productSnapshot: approval.productSnapshot,
    copy: representation.copy,
    evidence,
  });
  if (approval.payloadDigest !== expectedDigest || representation.payloadDigest !== expectedDigest) {
    throw new Error("Approval blocked: target, product snapshot, copy, evidence provenance, or payload digest changed after approval.");
  }
  return deepFreeze({ ...captured, payloadDigest: expectedDigest });
}

export async function assertApprovalBinding(input: ApprovalBindingInput): Promise<string> {
  return (await verifyApprovalBinding(input)).payloadDigest;
}
