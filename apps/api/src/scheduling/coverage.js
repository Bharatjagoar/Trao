// Deterministic — the brief is explicit that coverage checking is the
// application's decision, never the model's.

export function findUncoveredRequirements(requirements, questions) {
  const covered = new Set();
  for (const q of questions) {
    for (const rid of q.requirement_ids) covered.add(rid);
  }
  return requirements.filter((r) => !covered.has(r.id)).map((r) => r.id);
}

export function findUncoveredMustHaves(requirements, questions) {
  const uncoveredIds = new Set(findUncoveredRequirements(requirements, questions));
  return requirements
    .filter((r) => r.priority === "must" && uncoveredIds.has(r.id))
    .map((r) => r.id);
}
