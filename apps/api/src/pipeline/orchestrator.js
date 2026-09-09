import { validateKit } from "../schema/kitSchema.js";
import { extractRequirements } from "../llm/prompts/extractRequirements.js";
import { generateCompanyBrief } from "../llm/prompts/companyBrief.js";
import { generateQuestionsForRequirements } from "../llm/prompts/generateQuestions.js";
import { generateFlashcards } from "../llm/prompts/generateFlashcards.js";
import { crawlCompanySite } from "../retrieval/crawler.js";
import { searchPublicDiscussion } from "../retrieval/publicDiscussion.js";
import { validateExternalUrl } from "../security/urlValidation.js";
import { buildSchedule } from "../scheduling/scheduler.js";
import { findUncoveredMustHaves, findUncoveredRequirements } from "../scheduling/coverage.js";

const MAX_COVERAGE_PASSES = 3;

const KIND_TO_CATEGORY = {
  technical: "technical",
  behavioural: "behavioural",
  domain: "company-fit",
};

/**
 * The full research -> generation -> validation pipeline, used identically
 * by the Express API and the batch CLI (Section 9 requires the same code
 * path, not a parallel implementation). Each step below responds to what
 * the previous step actually found rather than being one big prompt.
 */
export async function generateKit(input) {
  const warnings = [];

  if (!input.jd || input.jd.trim().length < 10) {
    warnings.push("Job description is extremely short — extraction will be thin, not fabricated.");
  }

  // Step 1: pasted text needs no retrieval — extract requirements directly.
  const extracted = await extractRequirements(input.jd);
  const requirements = extracted.requirements.map((r, i) => ({
    id: `r${i + 1}`,
    text: r.text,
    kind: r.kind,
    priority: r.priority,
  }));

  // Step 2: research the company. A homepage needs crawling before it's useful.
  let pagesUsed = [];
  let aboutText = "";
  let hiringPageUrl;
  let hiringText;
  const companyName = deriveCompanyName(input.companyUrl);

  const urlCheck = await validateExternalUrl(input.companyUrl, {
    allowPrivateNetworks: input.allowPrivateNetworks,
  });
  if (!urlCheck.ok) {
    warnings.push(`Company URL could not be used: ${urlCheck.reason}`);
  } else {
    try {
      const crawl = await crawlCompanySite(input.companyUrl, {
        allowPrivateNetworks: input.allowPrivateNetworks,
      });
      pagesUsed = crawl.pagesUsed;
      aboutText = crawl.aboutText;
      hiringPageUrl = crawl.hiringPageUrl;
      hiringText = crawl.hiringText;
      for (const s of crawl.skipped) warnings.push(`Skipped ${s.url}: ${s.reason}`);
      if (!hiringPageUrl) {
        warnings.push("No discoverable hiring/interview-process page found on the company site.");
      }
      if (pagesUsed.length === 0) {
        warnings.push("Company site could not be crawled — no pages were retrieved.");
      }
    } catch (err) {
      warnings.push(`Company site crawl failed: ${errMessage(err)}`);
    }
  }

  // Step 3: public discussion of the interview process — independent of the crawl.
  const discussion = await searchPublicDiscussion(companyName || safeHostname(input.companyUrl));
  if (!discussion.found) {
    warnings.push("No public discussion of this company's interview process was found.");
  }

  // Step 4: company brief — depends on steps 2 and 3 having run first.
  const brief = await generateCompanyBrief({
    companyName,
    aboutText,
    hiringText,
    discussionSummary: discussion.summary,
  });

  // What was found about the hiring process shapes what questions make
  // sense (e.g. a take-home + system-design round vs. nothing published).
  const hiringProcessNotes = [hiringText, discussion.summary]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  // Step 5: generate questions per requirement kind, each with its own
  // category-specific call — technical and behavioural never share a prompt.
  let questions = await generateQuestionsForKinds(requirements, extracted.title, hiringProcessNotes);

  if (/system[\s-]?design/i.test(hiringProcessNotes)) {
    const technicalMusts = requirements.filter(
      (r) => r.kind === "technical" && r.priority === "must"
    );
    const sdItems = await generateQuestionsForRequirements({
      requirements: technicalMusts,
      category: "system-design",
      roleTitle: extracted.title,
      hiringProcessNotes,
    });
    questions = questions.concat(
      toQuestions(sdItems, "system-design", requirements, questions.length)
    );
  }

  // Step 6 (deterministic — not the model's decision): coverage check, then
  // act on the gaps and check again.
  let passes = 1;
  for (; passes <= MAX_COVERAGE_PASSES; passes++) {
    const gapIds = findUncoveredRequirements(requirements, questions);
    if (gapIds.length === 0) break;

    const gapRequirements = requirements.filter((r) => gapIds.includes(r.id));
    const gapQuestions = await generateQuestionsForKinds(
      gapRequirements,
      extracted.title,
      hiringProcessNotes
    );
    if (gapQuestions.length === 0) break; // model produced nothing new — stop rather than loop forever
    questions = questions.concat(shiftIds(gapQuestions, questions.length));
  }
  const uncovered = findUncoveredRequirements(requirements, questions);
  if (uncovered.length > 0) {
    const mustGaps = findUncoveredMustHaves(requirements, questions);
    warnings.push(
      `${uncovered.length} requirement(s) remain uncovered after ${passes} pass(es)` +
        (mustGaps.length > 0 ? ` (${mustGaps.length} are must-have).` : ".")
    );
  }

  // Step 7: flashcards, from the same validated requirement set.
  const rawFlashcards = await generateFlashcards(requirements);
  const requirementIds = new Set(requirements.map((r) => r.id));
  const flashcards = rawFlashcards.map((f, i) => ({
    id: `f${i + 1}`,
    front: f.front,
    back: f.back,
    requirement_ids: f.requirement_ids.filter((id) => requirementIds.has(id)),
  }));

  // Step 8 (deterministic): schedule allocation is arithmetic, done in code.
  const schedule = buildSchedule(requirements, questions, input.days);

  const kit = {
    source: {
      company: companyName,
      company_url: input.companyUrl,
      role: extracted.title,
      location: "",
      jd_chars: input.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed,
    },
    company_brief: {
      summary: brief.summary,
      what_they_do: brief.what_they_do,
      sources: Array.from(new Set([...pagesUsed, ...discussion.sources])).slice(0, 20),
    },
    role: {
      title: extracted.title,
      seniority: extracted.seniority,
      responsibilities: extracted.responsibilities,
      requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage: { uncovered_requirement_ids: uncovered, passes },
  };

  const validation = validateKit(kit);
  if (!validation.valid) {
    throw new Error(`Generated kit failed structural validation: ${validation.errors.join("; ")}`);
  }

  const research = {
    aboutText,
    hiringText,
    hiringPageUrl,
    pagesUsed,
    discussionSummary: discussion.summary,
    discussionSources: discussion.sources,
  };

  return { kit, warnings, research };
}

async function generateQuestionsForKinds(requirements, roleTitle, hiringProcessNotes) {
  const byKind = new Map();
  for (const r of requirements) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  let all = [];
  for (const [kind, reqs] of byKind) {
    const category = KIND_TO_CATEGORY[kind];
    const items = await generateQuestionsForRequirements({
      requirements: reqs,
      category,
      roleTitle,
      hiringProcessNotes,
    });
    all = all.concat(toQuestions(items, category, reqs, all.length));
  }
  return all;
}

function toQuestions(items, category, scopeRequirements, startIndex) {
  const scopeIds = new Set(scopeRequirements.map((r) => r.id));
  return items.map((item, i) => ({
    id: `q${startIndex + i + 1}`,
    requirement_ids: item.requirement_ids.filter((id) => scopeIds.has(id)),
    category,
    prompt: item.prompt,
    answer_outline: item.answer_outline,
    difficulty: item.difficulty,
  }));
}

function shiftIds(questions, startIndex) {
  return questions.map((q, i) => ({ ...q, id: `q${startIndex + i + 1}` }));
}

function deriveCompanyName(companyUrl) {
  try {
    const host = new URL(companyUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0];
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "";
  }
}

function safeHostname(companyUrl) {
  try {
    return new URL(companyUrl).hostname;
  } catch {
    return companyUrl;
  }
}

function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
