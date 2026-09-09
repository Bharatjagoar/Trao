// Tracks generated / edited / pinned state per addressable kit item, stored
// as a sibling of the Appendix A `kit` object (never inside it, so the kit
// structure itself always matches the spec exactly).
//
// Design: collection sections (questions, flashcards) are regenerated
// per-item — an item marked "edited" or "pinned" is excluded from being
// replaced when its category/section is regenerated, while untouched
// ("generated") items in that same category are dropped and replaced.
// Single-blob sections (company_brief, schedule) are regenerated wholesale
// on request; the API flags it when that would discard an edit so the
// caller can warn the user first.

export function initialMeta(questionIds, flashcardIds) {
  const questions = {};
  for (const id of questionIds) questions[id] = "generated";
  const flashcards = {};
  for (const id of flashcardIds) flashcards[id] = "generated";
  return {
    company_brief: { state: "generated" },
    schedule: { state: "generated" },
    questions,
    flashcards,
  };
}

export function markEdited(meta, section, id) {
  const current = meta[section][id];
  return {
    ...meta,
    [section]: { ...meta[section], [id]: current === "pinned" ? "pinned" : "edited" },
  };
}

export function markPinned(meta, section, id) {
  return { ...meta, [section]: { ...meta[section], [id]: "pinned" } };
}

export function isProtected(meta, section, id) {
  const state = meta[section][id];
  return state === "edited" || state === "pinned";
}
