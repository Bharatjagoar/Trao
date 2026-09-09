import { z } from "zod";

// Mirrors Appendix A of the brief exactly. Field names and nesting must not change.

export const RequirementKind = z.enum(["technical", "behavioural", "domain"]);
export const RequirementPriority = z.enum(["must", "nice"]);
export const QuestionCategory = z.enum([
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
]);

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: RequirementKind,
  priority: RequirementPriority,
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: QuestionCategory,
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
});

export const scheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().min(0),
});

export const scheduleSchema = z.object({
  days_available: z.number().int().min(1),
  days: z.array(scheduleDaySchema),
});

export const coverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().min(0),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().min(0),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: scheduleSchema,
  coverage: coverageSchema,
});

/**
 * Structural (zod) validation plus the cross-reference rules the brief calls out:
 * every question_ids entry in the schedule must refer to a question that exists,
 * and every requirement_ids entry on a question/flashcard must refer to a real requirement.
 */
export function validateKit(candidate) {
  const parsed = kitSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const kit = parsed.data;
  const errors = [];
  const requirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const questionIds = new Set(kit.questions.map((q) => q.id));

  if (requirementIds.size !== kit.role.requirements.length) {
    errors.push("role.requirements contains duplicate ids");
  }
  if (questionIds.size !== kit.questions.length) {
    errors.push("questions contains duplicate ids");
  }

  for (const q of kit.questions) {
    for (const rid of q.requirement_ids) {
      if (!requirementIds.has(rid)) {
        errors.push(`question ${q.id} references unknown requirement ${rid}`);
      }
    }
  }

  for (const f of kit.flashcards) {
    for (const rid of f.requirement_ids) {
      if (!requirementIds.has(rid)) {
        errors.push(`flashcard ${f.id} references unknown requirement ${rid}`);
      }
    }
  }

  for (const day of kit.schedule.days) {
    for (const qid of day.question_ids) {
      if (!questionIds.has(qid)) {
        errors.push(`schedule day ${day.day} references unknown question ${qid}`);
      }
    }
  }

  if (kit.schedule.days.length !== kit.schedule.days_available) {
    errors.push(
      `schedule.days has ${kit.schedule.days.length} entries but days_available is ${kit.schedule.days_available}`
    );
  }

  for (const rid of kit.coverage.uncovered_requirement_ids) {
    if (!requirementIds.has(rid)) {
      errors.push(`coverage references unknown requirement ${rid}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
