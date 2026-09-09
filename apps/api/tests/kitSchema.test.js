import { describe, expect, it } from "vitest";
import { validateKit } from "../src/schema/kitSchema.js";

function baseKit() {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.example",
      role: "Backend Engineer",
      location: "",
      jd_chars: 500,
      researched_at: new Date().toISOString(),
      pages_used: ["https://acme.example"],
    },
    company_brief: { summary: "A company.", what_they_do: "Makes things.", sources: [] },
    role: {
      title: "Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Ship features"],
      requirements: [{ id: "r1", text: "5+ years with React", kind: "technical", priority: "must" }],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain reconciliation.",
        answer_outline: "Discuss the virtual DOM diffing.",
        difficulty: 2,
      },
    ],
    flashcards: [{ id: "f1", front: "What is reconciliation?", back: "Diffing algorithm.", requirement_ids: ["r1"] }],
    schedule: { days_available: 1, days: [{ day: 1, focus: "technical", question_ids: ["q1"], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe("validateKit", () => {
  it("accepts a well-formed kit", () => {
    const result = validateKit(baseKit());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a schedule day referencing a question that does not exist", () => {
    const kit = baseKit();
    kit.schedule.days[0].question_ids.push("q_missing");
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("q_missing"))).toBe(true);
  });

  it("rejects a question referencing an unknown requirement", () => {
    const kit = baseKit();
    kit.questions[0].requirement_ids.push("r_missing");
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("rejects duplicate requirement ids", () => {
    const kit = baseKit();
    kit.role.requirements.push({ ...kit.role.requirements[0] });
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("rejects a mismatched days_available count", () => {
    const kit = baseKit();
    kit.schedule.days_available = 3;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-integer difficulty via the structural schema", () => {
    const kit = baseKit();
    kit.questions[0].difficulty = 1.5;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown priority value", () => {
    const kit = baseKit();
    kit.role.requirements[0].priority = "should-have";
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });
});
