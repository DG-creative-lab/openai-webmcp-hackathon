import {
  COMMERCE_CONTRACT_VERSION,
  type ApprovalEnvelope,
  type CommerceCopy,
  type CommerceIdentity,
  type EvidenceRecord,
  type RepresentationVariant,
} from "./contracts";

function sameIdentity(left: Readonly<CommerceIdentity>, right: Readonly<CommerceIdentity>): boolean {
  return left.provider === right.provider && left.storeId === right.storeId && left.productId === right.productId;
}

export function isEvidenceAuthoritativeForTarget(record: EvidenceRecord, target: Readonly<CommerceIdentity>): boolean {
  return record.contractVersion === COMMERCE_CONTRACT_VERSION
    && sameIdentity(record.productIdentity, target)
    && record.verified
    && Boolean(record.provenance.source && record.provenance.reference && record.provenance.observedAt);
}

function evidenceAuthority(record: EvidenceRecord) {
  return {
    contractVersion: record.contractVersion,
    productIdentity: record.productIdentity,
    id: record.id,
    label: record.label,
    value: record.value,
    source: record.source,
    verified: record.verified,
    tags: [...record.tags].sort(),
    provenance: record.provenance,
  };
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return `fnv1a-${(result >>> 0).toString(16).padStart(8, "0")}`;
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
    if (!record.provenance.source || !record.provenance.reference || !record.provenance.observedAt) {
      throw new Error(`Approval blocked: evidence ${record.id} is missing provenance.`);
    }
  }
}

export function digestApprovalPayload(input: {
  target: Readonly<CommerceIdentity>;
  copy: Readonly<CommerceCopy> & { readonly bullets: readonly string[] };
  evidence: readonly EvidenceRecord[];
}): string {
  const canonical = {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    target: input.target,
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

export function assertApprovalBinding(input: {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
}): string {
  const { approval, representation, evidence } = input;
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
  const expectedDigest = digestApprovalPayload({ target: approval.target, copy: representation.copy, evidence });
  if (approval.payloadDigest !== expectedDigest || representation.payloadDigest !== expectedDigest) {
    throw new Error("Approval blocked: target, copy, evidence provenance, or payload digest changed after approval.");
  }
  return expectedDigest;
}
