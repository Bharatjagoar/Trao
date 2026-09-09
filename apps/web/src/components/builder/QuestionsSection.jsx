"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { RegenerateButton, SectionCard, StateBadge } from "./SectionCard";

const CATEGORIES = [
  { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" },
  { key: "system-design", label: "System design" },
  { key: "company-fit", label: "Company fit" },
];

export function QuestionsSection({ kitId, kit, meta, onUpdated }) {
  const [regenerating, setRegenerating] = useState(null);
  const [error, setError] = useState(null);
  const [addingTo, setAddingTo] = useState(null);

  async function handleRegenerate(category) {
    setRegenerating(category);
    setError(null);
    try {
      const { kit: updated, meta: updatedMeta } = await api.regenerate(kitId, category);
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(null);
    }
  }

  function moveQuestion(id, direction) {
    const ids = kit.questions.map((q) => q.id);
    const category = kit.questions.find((q) => q.id === id)?.category;
    const sameCategoryIds = kit.questions.filter((q) => q.category === category).map((q) => q.id);
    const posInCategory = sameCategoryIds.indexOf(id);
    const swapWith = direction === "up" ? sameCategoryIds[posInCategory - 1] : sameCategoryIds[posInCategory + 1];
    if (!swapWith) return;

    const globalIndexA = ids.indexOf(id);
    const globalIndexB = ids.indexOf(swapWith);
    const reordered = [...ids];
    [reordered[globalIndexA], reordered[globalIndexB]] = [reordered[globalIndexB], reordered[globalIndexA]];

    api
      .reorderQuestions(kitId, reordered)
      .then(({ kit: updated, meta: updatedMeta }) => onUpdated(updated, updatedMeta))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reorder."));
  }

  async function handleFieldSave(qid, data) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.editQuestion(kitId, qid, data);
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the edit.");
    }
  }

  async function handleDelete(qid) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.deleteQuestion(kitId, qid);
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the question.");
    }
  }

  async function handlePin(qid) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.pinQuestion(kitId, qid);
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not pin the question.");
    }
  }

  async function handleAdd(category, data) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.addQuestion(kitId, { ...data, category });
      onUpdated(updated, updatedMeta);
      setAddingTo(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the question.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {CATEGORIES.map(({ key, label }) => {
        const questions = kit.questions.filter((q) => q.category === key);
        return (
          <SectionCard
            key={key}
            title={`${label} questions`}
            badge={<span className="text-xs text-black/50 dark:text-white/50">{questions.length}</span>}
            actions={
              <div className="flex gap-2">
                <button
                  onClick={() => setAddingTo(addingTo === key ? null : key)}
                  className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  + Add
                </button>
                <RegenerateButton onClick={() => handleRegenerate(key)} disabled={regenerating === key} />
              </div>
            }
          >
            {addingTo === key && (
              <AddQuestionForm requirements={kit.role.requirements} onSubmit={(data) => handleAdd(key, data)} onCancel={() => setAddingTo(null)} />
            )}
            {questions.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">No questions in this category yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {questions.map((q, i) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    state={meta.questions[q.id] ?? "generated"}
                    requirements={kit.role.requirements}
                    isFirst={i === 0}
                    isLast={i === questions.length - 1}
                    onSave={(data) => handleFieldSave(q.id, data)}
                    onDelete={() => handleDelete(q.id)}
                    onPin={() => handlePin(q.id)}
                    onMove={(dir) => moveQuestion(q.id, dir)}
                    onCategoryChange={(category) => handleFieldSave(q.id, { category })}
                  />
                ))}
              </ul>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

function QuestionRow({
  question,
  state,
  requirements,
  isFirst,
  isLast,
  onSave,
  onDelete,
  onPin,
  onMove,
  onCategoryChange,
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [answer, setAnswer] = useState(question.answer_outline);

  return (
    <li className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StateBadge state={state} />
        <span className="text-xs text-black/50 dark:text-white/50">Difficulty</span>
        <select
          value={question.difficulty}
          onChange={(e) => onSave({ difficulty: Number(e.target.value) })}
          className="rounded border border-black/15 bg-transparent px-1.5 py-0.5 text-xs dark:border-white/20"
        >
          <option value={1}>1 — easy</option>
          <option value={2}>2 — medium</option>
          <option value={3}>3 — hard</option>
        </select>
        <select
          value={question.category}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="Move to category"
          className="rounded border border-black/15 bg-transparent px-1.5 py-0.5 text-xs dark:border-white/20"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => onMove("up")}
            disabled={isFirst}
            aria-label="Move up"
            className="rounded border border-black/15 px-2 py-0.5 text-xs disabled:opacity-30 dark:border-white/20"
          >
            ↑
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={isLast}
            aria-label="Move down"
            className="rounded border border-black/15 px-2 py-0.5 text-xs disabled:opacity-30 dark:border-white/20"
          >
            ↓
          </button>
          {state !== "pinned" && (
            <button onClick={onPin} className="rounded border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
              Pin
            </button>
          )}
          <button onClick={onDelete} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 dark:border-red-900 dark:text-red-400">
            Delete
          </button>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => prompt !== question.prompt && onSave({ prompt })}
        rows={2}
        className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() => answer !== question.answer_outline && onSave({ answer_outline: answer })}
        rows={2}
        placeholder="Answer outline"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      {question.requirement_ids.length > 0 && (
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          Covers: {question.requirement_ids.map((id) => requirements.find((r) => r.id === id)?.text ?? id).join(", ")}
        </p>
      )}
    </li>
  );
}

function AddQuestionForm({ requirements, onSubmit, onCancel }) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [selected, setSelected] = useState([]);

  return (
    <div className="mb-3 rounded-md border border-dashed border-black/20 p-3 dark:border-white/25">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Question prompt"
        rows={2}
        className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none dark:border-white/20"
      />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Answer outline"
        rows={2}
        className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none dark:border-white/20"
      />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-black/50 dark:text-white/50">Difficulty</label>
        <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="rounded border border-black/15 bg-transparent px-1.5 py-0.5 text-xs dark:border-white/20">
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </div>
      {requirements.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {requirements.map((r) => (
            <label key={r.id} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                }
              />
              {r.text.slice(0, 30)}
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => prompt.trim() && onSubmit({ prompt, answer_outline: answer, difficulty, requirement_ids: selected })}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
        >
          Add question
        </button>
        <button onClick={onCancel} className="rounded-md border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">
          Cancel
        </button>
      </div>
    </div>
  );
}
