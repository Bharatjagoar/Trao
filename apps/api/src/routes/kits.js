import { Router } from "express";
import { z } from "zod";
import { Kit as KitDoc, makeDedupeKey } from "../models/Kit.js";
import { requireAuth } from "../auth/middleware.js";
import { generateKit } from "../pipeline/orchestrator.js";
import {
  regenerateCompanyBrief,
  regenerateQuestionCategory,
  regenerateSchedule,
} from "../pipeline/regenerate.js";
import { validateKit } from "../schema/kitSchema.js";
import { findUncoveredRequirements } from "../scheduling/coverage.js";
import { DIFFICULTY_MINUTES } from "../scheduling/scheduler.js";
import { initialMeta, isProtected, markEdited, markPinned } from "../state/kitState.js";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  jd: z.string().min(1, "Job description is required"),
  companyUrl: z.string().url("A valid company URL is required"),
  days: z.number().int().min(1).max(90),
});

const batchSchema = z.object({
  cases: z.array(createSchema).min(1).max(25),
});

async function runGeneration(kitId) {
  const doc = await KitDoc.findById(kitId);
  if (!doc) return;

  doc.status = "generating";
  await doc.save();

  try {
    const { kit, warnings, research } = await generateKit({
      jd: doc.input.jd,
      companyUrl: doc.input.companyUrl,
      days: doc.input.days,
      allowPrivateNetworks: false,
    });

    doc.kit = kit;
    doc.meta = initialMeta(
      kit.questions.map((q) => q.id),
      kit.flashcards.map((f) => f.id)
    );
    doc.research = research;
    doc.warnings = warnings;
    doc.status = "ready";
    doc.error = undefined;
  } catch (err) {
    doc.status = "failed";
    doc.error = {
      code: "GENERATION_FAILED",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  await doc.save();
}

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } });
    return;
  }
  const { jd, companyUrl, days } = parsed.data;
  const dedupeKey = makeDedupeKey(req.userId, jd, companyUrl);

  const existing = await KitDoc.findOne({ userId: req.userId, dedupeKey, status: { $in: ["pending", "generating", "ready"] } });
  if (existing) {
    res.status(200).json({ id: existing._id, status: existing.status, duplicate: true });
    return;
  }

  const doc = await KitDoc.create({
    userId: req.userId,
    status: "pending",
    input: { jd, companyUrl, days },
    dedupeKey,
  });

  void runGeneration(String(doc._id));
  res.status(202).json({ id: doc._id, status: "pending" });
});

router.post("/batch", async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } });
    return;
  }

  const created = [];
  for (const c of parsed.data.cases) {
    const dedupeKey = makeDedupeKey(req.userId, c.jd, c.companyUrl);
    const existing = await KitDoc.findOne({ userId: req.userId, dedupeKey, status: { $in: ["pending", "generating", "ready"] } });
    if (existing) {
      created.push({ id: String(existing._id), status: existing.status });
      continue;
    }
    const doc = await KitDoc.create({
      userId: req.userId,
      status: "pending",
      input: { jd: c.jd, companyUrl: c.companyUrl, days: c.days },
      dedupeKey,
    });
    created.push({ id: String(doc._id), status: "pending" });
    void runGeneration(String(doc._id));
  }

  res.status(202).json({ kits: created });
});

router.get("/", async (req, res) => {
  const docs = await KitDoc.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
  res.json({
    kits: docs.map((d) => ({
      id: d._id,
      status: d.status,
      title: d.kit ? `${d.kit.role.title} @ ${d.kit.source.company}` : "Generating…",
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
});

async function loadOwned(id, userId) {
  const doc = await KitDoc.findOne({ _id: id, userId });
  return doc;
}

router.get("/:id", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found." } });
    return;
  }
  res.json({
    id: doc._id,
    status: doc.status,
    input: doc.input,
    kit: doc.kit,
    meta: doc.meta,
    warnings: doc.warnings,
    error: doc.error,
  });
});

router.delete("/:id", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found." } });
    return;
  }
  await doc.deleteOne();
  res.status(204).send();
});

function requireReadyKit(doc) {
  if (!doc || !doc.kit) return null;
  return doc.kit;
}

function pruneAndRecalcSchedule(kit) {
  const byId = new Map(kit.questions.map((q) => [q.id, q]));
  for (const day of kit.schedule.days) {
    day.question_ids = day.question_ids.filter((id) => byId.has(id));
    day.minutes = day.question_ids.reduce(
      (sum, id) => sum + (DIFFICULTY_MINUTES[byId.get(id).difficulty] ?? 20),
      0
    );
  }
}

function recomputeCoverage(kit) {
  kit.coverage.uncovered_requirement_ids = findUncoveredRequirements(
    kit.role.requirements,
    kit.questions
  );
}

async function persist(doc, kit, meta) {
  const validation = validateKit(kit);
  if (!validation.valid) {
    throw new Error(`Edit produced an invalid kit: ${validation.errors.join("; ")}`);
  }
  doc.kit = kit;
  doc.meta = meta;
  doc.markModified("kit");
  doc.markModified("meta");
  await doc.save();
}

// ---- Company brief ----

const briefEditSchema = z.object({ summary: z.string().optional(), what_they_do: z.string().optional() });

router.patch("/:id/brief", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const parsed = briefEditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid brief edit." } });
    return;
  }
  if (parsed.data.summary !== undefined) kit.company_brief.summary = parsed.data.summary;
  if (parsed.data.what_they_do !== undefined) kit.company_brief.what_they_do = parsed.data.what_they_do;

  const meta = doc.meta;
  meta.company_brief.state = "edited";
  await persist(doc, kit, meta);
  res.json({ kit, meta });
});

// ---- Questions ----

const questionCreateSchema = z.object({
  requirement_ids: z.array(z.string()).default([]),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string().min(1),
  answer_outline: z.string().default(""),
  difficulty: z.number().int().min(1).max(3),
});

router.post("/:id/questions", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const parsed = questionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid question." } });
    return;
  }
  const validRequirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const requirement_ids = parsed.data.requirement_ids.filter((id) => validRequirementIds.has(id));

  const nextNum = kit.questions.length + 1;
  const id = `q_manual_${nextNum}_${Date.now().toString(36)}`;
  const question = { id, ...parsed.data, requirement_ids };
  kit.questions.push(question);
  recomputeCoverage(kit);

  const meta = doc.meta;
  meta.questions[id] = "pinned"; // hand-authored — always protected from regeneration
  await persist(doc, kit, meta);
  res.status(201).json({ kit, meta });
});

const questionEditSchema = z.object({
  prompt: z.string().optional(),
  answer_outline: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]).optional(),
  requirement_ids: z.array(z.string()).optional(),
});

router.patch("/:id/questions/:qid", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const question = kit.questions.find((q) => q.id === req.params.qid);
  if (!question) {
    res.status(404).json({ error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } });
    return;
  }
  const parsed = questionEditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid edit." } });
    return;
  }
  Object.assign(question, parsed.data);
  recomputeCoverage(kit);
  pruneAndRecalcSchedule(kit);

  const meta = doc.meta;
  const updatedMeta = markEdited(meta, "questions", question.id);
  await persist(doc, kit, updatedMeta);
  res.json({ kit, meta: updatedMeta });
});

router.delete("/:id/questions/:qid", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  kit.questions = kit.questions.filter((q) => q.id !== req.params.qid);
  recomputeCoverage(kit);
  pruneAndRecalcSchedule(kit);

  const meta = doc.meta;
  delete meta.questions[req.params.qid];
  await persist(doc, kit, meta);
  res.json({ kit, meta });
});

const reorderSchema = z.object({ ids: z.array(z.string()).min(1) });

router.put("/:id/questions/order", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid order." } });
    return;
  }
  const byId = new Map(kit.questions.map((q) => [q.id, q]));
  const reordered = parsed.data.ids.map((id) => byId.get(id)).filter((q) => Boolean(q));
  if (reordered.length !== kit.questions.length) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Order must include every existing question id exactly once." } });
    return;
  }
  kit.questions = reordered;
  const meta = doc.meta;
  await persist(doc, kit, meta);
  res.json({ kit, meta });
});

// ---- Flashcards ----

const flashcardCreateSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).default([]),
});

router.post("/:id/flashcards", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const parsed = flashcardCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid flashcard." } });
    return;
  }
  const validRequirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const requirement_ids = parsed.data.requirement_ids.filter((id) => validRequirementIds.has(id));
  const id = `f_manual_${kit.flashcards.length + 1}_${Date.now().toString(36)}`;
  kit.flashcards.push({ id, front: parsed.data.front, back: parsed.data.back, requirement_ids });

  const meta = doc.meta;
  meta.flashcards[id] = "pinned";
  await persist(doc, kit, meta);
  res.status(201).json({ kit, meta });
});

const flashcardEditSchema = z.object({
  front: z.string().optional(),
  back: z.string().optional(),
  requirement_ids: z.array(z.string()).optional(),
});

router.patch("/:id/flashcards/:fid", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const card = kit.flashcards.find((f) => f.id === req.params.fid);
  if (!card) {
    res.status(404).json({ error: { code: "FLASHCARD_NOT_FOUND", message: "Flashcard not found." } });
    return;
  }
  const parsed = flashcardEditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid edit." } });
    return;
  }
  Object.assign(card, parsed.data);
  const meta = doc.meta;
  const updatedMeta = markEdited(meta, "flashcards", card.id);
  await persist(doc, kit, updatedMeta);
  res.json({ kit, meta: updatedMeta });
});

router.delete("/:id/flashcards/:fid", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  kit.flashcards = kit.flashcards.filter((f) => f.id !== req.params.fid);
  const meta = doc.meta;
  delete meta.flashcards[req.params.fid];
  await persist(doc, kit, meta);
  res.json({ kit, meta });
});

// ---- Pin (protect an item from future category regeneration without editing it) ----

router.post("/:id/questions/:qid/pin", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const meta = doc.meta;
  const updatedMeta = markPinned(meta, "questions", req.params.qid);
  await persist(doc, kit, updatedMeta);
  res.json({ kit, meta: updatedMeta });
});

// ---- Regenerate one section ----

const regenerateSchema = z.object({
  section: z.enum(["company_brief", "schedule", "technical", "behavioural", "system-design", "company-fit"]),
});

router.post("/:id/regenerate", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const parsed = regenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid section." } });
    return;
  }
  const meta = doc.meta;
  const research = doc.research;

  try {
    if (parsed.data.section === "company_brief") {
      if (!research) throw new Error("No cached research available for this kit.");
      const brief = await regenerateCompanyBrief(kit.source.company, research);
      kit.company_brief.summary = brief.summary;
      kit.company_brief.what_they_do = brief.what_they_do;
      meta.company_brief.state = "generated";
    } else if (parsed.data.section === "schedule") {
      kit.schedule = regenerateSchedule(kit.role.requirements, kit.questions, kit.schedule.days_available);
      meta.schedule.state = "generated";
    } else {
      const category = parsed.data.section;
      const untouchedIds = kit.questions
        .filter((q) => q.category === category && !isProtected(meta, "questions", q.id))
        .map((q) => q.id);
      const untouchedSet = new Set(untouchedIds);

      // Requirements this category is responsible for: anything currently
      // covered only by a to-be-replaced question, plus anything in this
      // category's kind that has no coverage at all.
      const kindForCategory = {
        technical: "technical",
        behavioural: "behavioural",
        "company-fit": "domain",
      };
      const targetRequirements = kit.role.requirements.filter((r) => {
        if (category !== "system-design" && r.kind === kindForCategory[category]) return true;
        const coveringQuestions = kit.questions.filter((q) => q.requirement_ids.includes(r.id));
        const onlyByRegenerated =
          coveringQuestions.length > 0 && coveringQuestions.every((q) => untouchedSet.has(q.id));
        return onlyByRegenerated;
      });

      const hiringProcessNotes = research
        ? [research.hiringText, research.discussionSummary].filter(Boolean).join("\n\n")
        : "";

      const items = await regenerateQuestionCategory({
        requirements: targetRequirements,
        category,
        roleTitle: kit.role.title,
        hiringProcessNotes,
      });

      kit.questions = kit.questions.filter((q) => !untouchedSet.has(q.id));
      let counter = kit.questions.length;
      for (const item of items) {
        counter += 1;
        const id = `q${counter}_${Date.now().toString(36)}`;
        kit.questions.push({
          id,
          category,
          prompt: item.prompt,
          answer_outline: item.answer_outline,
          difficulty: item.difficulty,
          requirement_ids: item.requirement_ids.filter((rid) =>
            kit.role.requirements.some((r) => r.id === rid)
          ),
        });
        meta.questions[id] = "generated";
      }
      for (const id of untouchedIds) delete meta.questions[id];

      recomputeCoverage(kit);
      if (meta.schedule.state !== "edited") {
        kit.schedule = regenerateSchedule(kit.role.requirements, kit.questions, kit.schedule.days_available);
      } else {
        pruneAndRecalcSchedule(kit);
      }
    }

    await persist(doc, kit, meta);
    res.json({ kit, meta });
  } catch (err) {
    res.status(502).json({
      error: { code: "REGENERATION_FAILED", message: err instanceof Error ? err.message : String(err) },
    });
  }
});

// ---- Practice mode ----

const practiceSchema = z.object({ confidence: z.number().int().min(1).max(5) });

router.post("/:id/practice/:cardId", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  if (!doc) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found." } });
    return;
  }
  const parsed = practiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "confidence must be 1-5." } });
    return;
  }
  const record = doc.get("practice") ?? {};
  record[req.params.cardId] = { confidence: parsed.data.confidence, at: new Date().toISOString() };
  doc.set("practice", record);
  doc.markModified("practice");
  await doc.save();
  res.json({ practice: record });
});

// Confidence-weighted ordering for the next practice session: cards never
// seen sort first (treated as maximum uncertainty), then lowest recorded
// confidence first. See README for why this over a full spaced-repetition
// interval scheduler.
router.get("/:id/practice/next", async (req, res) => {
  const doc = await loadOwned(req.params.id, req.userId);
  const kit = requireReadyKit(doc);
  if (!doc || !kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found or not ready." } });
    return;
  }
  const practice = doc.get("practice") ?? {};
  const ordered = [...kit.flashcards].sort((a, b) => {
    const ca = practice[a.id]?.confidence ?? 0;
    const cb = practice[b.id]?.confidence ?? 0;
    return ca - cb;
  });
  const covered = ordered.filter((c) => practice[c.id]).length;
  res.json({
    order: ordered.map((c) => c.id),
    covered,
    total: ordered.length,
  });
});

export default router;
