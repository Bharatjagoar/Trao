// Deterministic day allocation — arithmetic, not a model call, per the brief.
// Higher-priority / harder material is sorted to the front and distributed
// into contiguous day-chunks, so day 1 always carries the hardest material.

export const DIFFICULTY_MINUTES = { 1: 15, 2: 25, 3: 40 };
const EMPTY_DAY_MINUTES = 20;

function priorityScore(q, requirementById) {
  let score = q.difficulty * 10;
  for (const rid of q.requirement_ids) {
    if (requirementById.get(rid)?.priority === "must") score += 50;
  }
  if (q.category === "system-design") score += 5;
  return score;
}

export function buildSchedule(requirements, questions, daysAvailable) {
  if (!Number.isInteger(daysAvailable) || daysAvailable < 1) {
    throw new Error("daysAvailable must be a positive integer");
  }

  const requirementById = new Map(requirements.map((r) => [r.id, r]));
  const sorted = [...questions].sort(
    (a, b) => priorityScore(b, requirementById) - priorityScore(a, requirementById)
  );

  const n = sorted.length;
  const perDay = n > 0 ? Math.ceil(n / daysAvailable) : 0;
  const days = [];

  for (let d = 0; d < daysAvailable; d++) {
    const chunk = sorted.slice(d * perDay, (d + 1) * perDay);
    const categories = Array.from(new Set(chunk.map((q) => q.category)));
    const minutes = chunk.reduce(
      (sum, q) => sum + (DIFFICULTY_MINUTES[q.difficulty] ?? 20),
      0
    );

    days.push({
      day: d + 1,
      focus: chunk.length === 0 ? "Review and consolidation" : categories.join(" & "),
      question_ids: chunk.map((q) => q.id),
      minutes: chunk.length === 0 ? EMPTY_DAY_MINUTES : minutes,
    });
  }

  return { days_available: daysAvailable, days };
}
