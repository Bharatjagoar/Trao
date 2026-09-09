import { generateCompanyBrief } from "../llm/prompts/companyBrief.js";
import { generateQuestionsForRequirements } from "../llm/prompts/generateQuestions.js";
import { buildSchedule } from "../scheduling/scheduler.js";

export async function regenerateCompanyBrief(companyName, research) {
  return generateCompanyBrief({
    companyName,
    aboutText: research.aboutText,
    hiringText: research.hiringText,
    discussionSummary: research.discussionSummary,
  });
}

export function regenerateSchedule(requirements, questions, days) {
  return buildSchedule(requirements, questions, days);
}

/**
 * Regenerates the non-protected questions of one category. The caller is
 * responsible for filtering out requirements whose only questions are
 * pinned/edited (those must survive untouched) before calling this, and for
 * assigning fresh ids to the returned items.
 */
export async function regenerateQuestionCategory(params) {
  return generateQuestionsForRequirements(params);
}
