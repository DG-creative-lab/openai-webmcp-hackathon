import { beforeEach, describe, expect, it } from "vitest";
import { appStore } from "../store/appStore";
import { evaluateShopperNeed } from "./shopperMatch";

describe("shopper constraint evaluation", () => {
  beforeEach(() => appStore.reset());

  function evaluate(query: string, represented = true) {
    const state = appStore.getState();
    const representedEvidence = new Set(represented ? state.evidence.map((item) => item.id) : []);
    return evaluateShopperNeed(query, state.product, state.evidence, representedEvidence);
  }

  it.each([
    ["waterproof bag for a 16-inch laptop under £170", true, ["supported", "supported", "supported"]],
    ["waterproof laptop backpack", true, ["supported", "supported"]],
    ["waterproof bag for a 17-inch laptop", false, ["supported", "contradicted"]],
    ["waterproof bag under £150", false, ["supported", "contradicted"]],
    ["waterproof bag under £159", false, ["supported", "contradicted"]],
    ["not waterproof", false, ["contradicted"]],
    ["waterproof 16-inch laptop with solar charging", false, ["supported", "supported", "unknown"]],
    ["solar powered self-cleaning backpack", false, ["unknown"]],
  ] as const)("evaluates every material constraint in %s", (query, match, statuses) => {
    const result = evaluate(query);
    expect(result.match).toBe(match);
    expect(result.constraints.map((constraint) => constraint.status)).toEqual(statuses);
  });

  it("keeps a verified but unrepresented supporting fact unknown", () => {
    const result = evaluate("waterproof bag for a 16-inch laptop", false);
    expect(result.match).toBe(false);
    expect(result.constraints.map((constraint) => constraint.status)).toEqual(["unknown", "unknown"]);
    expect(result.evidence).toEqual([]);
  });

  it("returns a conservative unknown when no material constraint can be parsed", () => {
    expect(evaluate("recommend a bag")).toMatchObject({
      match: false,
      constraints: [{ id: "unrecognized-requirement", status: "unknown" }],
    });
  });
});
