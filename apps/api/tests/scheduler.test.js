import { describe, expect, it } from "vitest";
import { buildSchedule } from "../src/scheduling/scheduler.js";

function req(id, priority = "must") {
  return { id, text: id, kind: "technical", priority };
}

function q(id, requirement_ids, difficulty = 2) {
  return { id, requirement_ids, category: "technical", prompt: id, answer_outline: "", difficulty };
}

describe("buildSchedule", () => {
  it("produces exactly the requested number of days", () => {
    const schedule = buildSchedule([req("r1"), req("r2")], [q("q1", ["r1"]), q("q2", ["r2"])], 5);
    expect(schedule.days).toHaveLength(5);
    expect(schedule.days_available).toBe(5);
  });

  it("places every question somewhere in the schedule", () => {
    const questions = [q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])];
    const schedule = buildSchedule([req("r1"), req("r2"), req("r3")], questions, 2);
    const scheduled = schedule.days.flatMap((d) => d.question_ids).sort();
    expect(scheduled).toEqual(["q1", "q2", "q3"]);
  });

  it("sorts harder / must-have material into earlier days", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions = [q("q1", ["r2"], 1), q("q2", ["r1"], 3)];
    const schedule = buildSchedule(requirements, questions, 2);
    expect(schedule.days[0].question_ids).toContain("q2");
  });

  it("only ever produces integer minutes", () => {
    const schedule = buildSchedule([req("r1")], [q("q1", ["r1"], 2)], 3);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
    }
  });

  it("handles a 1-day schedule by putting everything on day 1", () => {
    const schedule = buildSchedule([req("r1")], [q("q1", ["r1"])], 1);
    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].question_ids).toEqual(["q1"]);
  });

  it("handles more days than questions without dropping days", () => {
    const schedule = buildSchedule([req("r1")], [q("q1", ["r1"])], 10);
    expect(schedule.days).toHaveLength(10);
    expect(schedule.days.some((d) => d.question_ids.length > 0)).toBe(true);
  });

  it("throws on a non-positive day count", () => {
    expect(() => buildSchedule([req("r1")], [q("q1", ["r1"])], 0)).toThrow();
  });
});
