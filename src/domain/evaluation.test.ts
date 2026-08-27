import { describe, expect, it } from "vitest";
import { buyerIntents, digestVariant, evaluateCopy } from "./evaluation";
import type { Evidence, ProductCopy } from "./types";

const evidence: Evidence[] = buyerIntents.map((intent) => ({
  id: intent.evidenceId,
  label: intent.shortLabel,
  value: intent.terms[0],
  source: "test source",
  verified: true,
  tags: [],
}));

describe("evidence-led evaluation", () => {
  it("does not award a match when evidence is absent from the copy", () => {
    const generic: ProductCopy = { title: "Good bag", description: "Made for every day", bullets: [] };
    expect(evaluateCopy(generic, evidence, "generic").score).toBe(0);
  });

  it("requires evidence to be verified", () => {
    const copy: ProductCopy = { title: "IPX6 waterproof bag", description: "", bullets: [] };
    const unverified = evidence.map((item) => item.id === "ev-waterproof" ? { ...item, verified: false } : item);
    expect(evaluateCopy(copy, unverified, "unverified").score).toBe(0);
  });

  it("creates a stable approval digest and detects changed copy", () => {
    const copy: ProductCopy = { title: "IPX6 waterproof bag", description: "Evidence led", bullets: [] };
    const first = digestVariant(copy, ["ev-waterproof"]);
    const reordered = digestVariant(copy, ["ev-waterproof"]);
    const changed = digestVariant({ ...copy, title: "Waterproof bag" }, ["ev-waterproof"]);
    expect(first).toBe(reordered);
    expect(changed).not.toBe(first);
  });
});
