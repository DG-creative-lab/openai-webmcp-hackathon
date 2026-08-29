import type { Evaluation, Evidence, ProductCopy } from "./types";
import type { CommerceIdentity } from "../commerce/contracts";
import { isEvidenceAuthoritativeForTarget } from "../commerce/approvalBinding";

export const buyerIntents = [
  { id: "wet", shortLabel: "Heavy rain", query: "A work bag that keeps a laptop dry in heavy rain", terms: ["ipx6", "waterproof"], evidenceId: "ev-waterproof" },
  { id: "laptop", shortLabel: "16-inch laptop", query: "A commuter bag that fits a 16-inch laptop", terms: ["16-inch", "16 inch"], evidenceId: "ev-laptop" },
  { id: "repair", shortLabel: "Repairable", query: "A bag I can repair instead of replace", terms: ["repair", "replaceable"], evidenceId: "ev-repair" },
  { id: "budget", shortLabel: "Under £180", query: "A technical commuter bag under £180", terms: ["£159", "159"], evidenceId: "ev-price" },
  { id: "delivery", shortLabel: "Friday delivery", query: "A bag that can arrive by Friday", terms: ["friday", "dispatch"], evidenceId: "ev-delivery" },
  { id: "weight", shortLabel: "Lightweight", query: "A lightweight pannier for a daily train-bike commute", terms: ["1.2kg", "1.2 kg"], evidenceId: "ev-weight" },
  { id: "rack", shortLabel: "Rack compatible", query: "A backpack that securely attaches to my bicycle rack", terms: ["rack", "12kg", "12 kg"], evidenceId: "ev-rack" },
  { id: "weekend", shortLabel: "24L capacity", query: "One 24-litre bag for commuting and a weekend away", terms: ["24l", "24 litre", "24-liter"], evidenceId: "ev-capacity" },
] as const;

export function evaluateCopy(copy: ProductCopy, evidence: Evidence[], label: string, productIdentity: Readonly<CommerceIdentity>): Evaluation {
  const haystack = [copy.title, copy.description, ...copy.bullets].join(" ").toLowerCase();
  const results = buyerIntents.map((intent) => {
    const source = evidence.find((item) => item.id === intent.evidenceId);
    const matched = Boolean(source && isEvidenceAuthoritativeForTarget(source, productIdentity) && intent.terms.some((term) => haystack.includes(term)));
    return {
      id: intent.id,
      query: intent.query,
      shortLabel: intent.shortLabel,
      matched,
      evidenceId: matched ? intent.evidenceId : null,
    };
  });

  return {
    id: `eval-${Date.now()}-${label.toLowerCase().replaceAll(" ", "-")}`,
    label,
    score: results.filter((item) => item.matched).length,
    total: results.length,
    results,
    createdAt: new Date().toISOString(),
  };
}
