import type { Evidence, Product, ShopperConstraint, ShopperMatch } from "./types";
import type { CommerceIdentity } from "../commerce/contracts";
import { isEvidenceAuthoritativeForTarget } from "../commerce/approvalBinding";

type Range = { start: number; end: number };

const ignoredWords = new Set([
  "a", "an", "and", "bag", "backpack", "best", "carry", "commuter", "daily", "everyday", "find", "for", "good", "i", "in", "is", "it", "looking", "me", "my", "need", "of", "or", "pack", "please", "product", "recommend", "show", "suitable", "that", "the", "this", "to", "use", "want", "we", "with",
]);

const featureRules: ReadonlyArray<{ id: string; requirement: string; evidenceId: string; positive: RegExp; negative?: RegExp }> = [
  { id: "weather-protection", requirement: "waterproof", evidenceId: "ev-waterproof", positive: /\b(?:waterproof|rainproof|rain[- ]resistant|heavy rain)\b/g, negative: /\b(?:not waterproof|without waterproof(?:ing)?|non[- ]waterproof)\b/g },
  { id: "repair-programme", requirement: "repair programme", evidenceId: "ev-repair", positive: /\b(?:repair(?:able| programme| program)?|five[- ]year repair|durab(?:le|ility))\b/g },
  { id: "rack-fit", requirement: "bicycle rack attachment", evidenceId: "ev-rack", positive: /\b(?:bike rack|bicycle rack|pannier|rack attachment)\b/g },
  { id: "delivery", requirement: "Friday delivery", evidenceId: "ev-delivery", positive: /\b(?:friday delivery|dispatch(?:es)? today|fast delivery)\b/g },
];

function summary(item: Evidence) {
  const { id, label, value, source } = item;
  return { id, label, value, source };
}

function collectRanges(pattern: RegExp, query: string): Range[] {
  return [...query.matchAll(pattern)].map((match) => ({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }));
}

function represented(item: Evidence | undefined, representedEvidenceIds: ReadonlySet<string>): boolean {
  return Boolean(item?.verified && representedEvidenceIds.has(item.id));
}

function evidenceConstraint(
  id: string,
  requirement: string,
  item: Evidence | undefined,
  representedEvidenceIds: ReadonlySet<string>,
  negated = false,
): ShopperConstraint {
  if (!item?.verified) {
    return { id, requirement, status: "unknown", evidence: [], explanation: "No verified product evidence can evaluate this requirement." };
  }
  if (negated) {
    return { id, requirement, status: "contradicted", evidence: [summary(item)], explanation: `Verified product evidence states ${item.value}.` };
  }
  if (!represented(item, representedEvidenceIds)) {
    return { id, requirement, status: "unknown", evidence: [], explanation: "The verified fact is not represented in the current visible copy." };
  }
  return { id, requirement, status: "supported", evidence: [summary(item)], explanation: `Supported by ${item.value}.` };
}

export function evaluateShopperNeed(
  rawQuery: string,
  product: Product,
  evidence: Evidence[],
  representedEvidenceIds: ReadonlySet<string>,
  productIdentity: Readonly<CommerceIdentity>,
): ShopperMatch {
  const query = rawQuery.toLowerCase();
  const constraints: ShopperConstraint[] = [];
  const consumed: Range[] = [];
  const byId = new Map(
    evidence
      .filter((item) => isEvidenceAuthoritativeForTarget(item, productIdentity))
      .map((item) => [item.id, item]),
  );

  featureRules.forEach((rule) => {
    const negativeRanges = rule.negative ? collectRanges(rule.negative, query) : [];
    const positiveRanges = collectRanges(rule.positive, query).filter((range) => !negativeRanges.some((negative) => range.start >= negative.start && range.end <= negative.end));
    if (negativeRanges.length) {
      consumed.push(...negativeRanges);
      constraints.push(evidenceConstraint(rule.id, `exclude ${rule.requirement}`, byId.get(rule.evidenceId), representedEvidenceIds, true));
    } else if (positiveRanges.length) {
      consumed.push(...positiveRanges);
      constraints.push(evidenceConstraint(rule.id, rule.requirement, byId.get(rule.evidenceId), representedEvidenceIds));
    }
  });

  const laptopMatches = [...query.matchAll(/\b(?:(?:that\s+)?fits?\s+(?:a\s+)?)?(\d+(?:\.\d+)?)\s*(?:-| )?inch(?:es)?(?:\s+laptop)?\b/g)];
  for (const match of laptopMatches) {
    const requestedSize = Number.parseFloat(match[1]);
    const item = byId.get("ev-laptop");
    const maxSize = Number.parseFloat(item?.value.match(/(\d+(?:\.\d+)?)[- ]inch/i)?.[1] ?? "NaN");
    consumed.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    if (!item?.verified || !Number.isFinite(maxSize)) {
      constraints.push({ id: "laptop-size", requirement: `${requestedSize}-inch laptop`, status: "unknown", evidence: [], explanation: "No verified maximum laptop size can evaluate this requirement." });
    } else if (requestedSize > maxSize) {
      constraints.push({ id: "laptop-size", requirement: `${requestedSize}-inch laptop`, status: "contradicted", evidence: [summary(item)], explanation: `Requested size exceeds the verified ${maxSize}-inch maximum.` });
    } else {
      constraints.push(evidenceConstraint("laptop-size", `${requestedSize}-inch laptop`, item, representedEvidenceIds));
    }
  }
  if (!laptopMatches.length) {
    const genericLaptopRanges = collectRanges(/\blaptop\b/g, query);
    if (genericLaptopRanges.length) {
      consumed.push(...genericLaptopRanges);
      constraints.push(evidenceConstraint("laptop-fit", "laptop carry", byId.get("ev-laptop"), representedEvidenceIds));
    }
  }

  const budgetPattern = /\b(under|below|less than|no more than|up to|max(?:imum)?(?: budget)?(?: of)?|budget(?: of)?)\s*(?:£|gbp\s*)?(\d+(?:\.\d+)?)\b/g;
  for (const match of query.matchAll(budgetPattern)) {
    const operator = match[1];
    const maximum = Number.parseFloat(match[2]);
    const inclusive = !/^(?:under|below|less than)$/.test(operator);
    const requirement = `price ${inclusive ? "at or below" : "below"} GBP ${maximum}`;
    const item = byId.get("ev-price");
    consumed.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
    if (!item?.verified) {
      constraints.push({ id: "maximum-price", requirement, status: "unknown", evidence: [], explanation: "No verified price can evaluate this budget." });
    } else if (product.price > maximum || (!inclusive && product.price === maximum)) {
      constraints.push({ id: "maximum-price", requirement, status: "contradicted", evidence: [summary(item)], explanation: `Verified price GBP ${product.price} does not satisfy the requested ${inclusive ? "maximum" : "strict upper bound"} of GBP ${maximum}.` });
    } else {
      constraints.push(evidenceConstraint("maximum-price", requirement, item, representedEvidenceIds));
    }
  }

  const residual = [...query].map((character, index) => consumed.some((range) => index >= range.start && index < range.end) ? " " : character).join("");
  const unknownWords = residual.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g)?.filter((word) => !ignoredWords.has(word)) ?? [];
  if (unknownWords.length) {
    const requirement = [...new Set(unknownWords)].join(" ");
    constraints.push({ id: "unrecognized-requirement", requirement, status: "unknown", evidence: [], explanation: "This bounded demo has no deterministic rule or represented evidence for this requirement." });
  }
  if (!constraints.length) {
    constraints.push({ id: "unrecognized-requirement", requirement: rawQuery, status: "unknown", evidence: [], explanation: "No material constraint could be evaluated from this query." });
  }

  const match = constraints.every((constraint) => constraint.status === "supported");
  const matchedEvidence = new Map(constraints.flatMap((constraint) => constraint.evidence).map((item) => [item.id, item]));
  return { match, constraints, evidence: [...matchedEvidence.values()] };
}
