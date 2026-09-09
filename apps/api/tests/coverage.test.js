import { describe, expect, it } from "vitest";
import { findUncoveredMustHaves, findUncoveredRequirements } from "../src/scheduling/coverage.js";

function req(id, priority = "must") {
  return { id, text: id, kind: "technical", priority };
}

function q(id, requirement_ids) {
  return { id, requirement_ids, category: "technical", prompt: id, answer_outline: "", difficulty: 1 };
}

describe("findUncoveredRequirements", () => {
  it("returns requirements with no covering question", () => {
    const gaps = findUncoveredRequirements([req("r1"), req("r2")], [q("q1", ["r1"])]);
    expect(gaps).toEqual(["r2"]);
  });

  it("returns an empty list when everything is covered", () => {
    const gaps = findUncoveredRequirements([req("r1"), req("r2")], [q("q1", ["r1", "r2"])]);
    expect(gaps).toEqual([]);
  });

  it("treats a requirement referenced by multiple questions as covered", () => {
    const gaps = findUncoveredRequirements([req("r1")], [q("q1", ["r1"]), q("q2", ["r1"])]);
    expect(gaps).toEqual([]);
  });
});

describe("findUncoveredMustHaves", () => {
  it("ignores gaps in nice-to-have requirements", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const gaps = findUncoveredMustHaves(requirements, []);
    expect(gaps).toEqual(["r1"]);
  });

  it("returns nothing once every must-have is covered", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const gaps = findUncoveredMustHaves(requirements, [q("q1", ["r1"])]);
    expect(gaps).toEqual([]);
  });
});
