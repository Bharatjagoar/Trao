"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { SectionCard, StateBadge } from "./SectionCard";

export function FlashcardsSection({ kitId, kit, meta, onUpdated }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(id, data) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.editFlashcard(kitId, id, data);
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the edit.");
    }
  }

  async function handleDelete(id) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.deleteFlashcard(kitId, id);
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the flashcard.");
    }
  }

  async function handleAdd(front, back, requirement_ids) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.addFlashcard(kitId, { front, back, requirement_ids });
      onUpdated(updated, updatedMeta);
      setAdding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the flashcard.");
    }
  }

  return (
    <SectionCard
      title="Flashcards"
      badge={<span className="text-xs text-black/50 dark:text-white/50">{kit.flashcards.length}</span>}
      actions={
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          + Add
        </button>
      }
    >
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {adding && (
        <AddFlashcardForm requirements={kit.role.requirements} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      )}
      {kit.flashcards.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No flashcards yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {kit.flashcards.map((card) => (
            <FlashcardRow
              key={card.id}
              card={card}
              state={meta.flashcards[card.id] ?? "generated"}
              onSave={(data) => handleSave(card.id, data)}
              onDelete={() => handleDelete(card.id)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function FlashcardRow({ card, state, onSave, onDelete }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  return (
    <li className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between">
        <StateBadge state={state} />
        <button onClick={onDelete} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 dark:border-red-900 dark:text-red-400">
          Delete
        </button>
      </div>
      <input
        value={front}
        onChange={(e) => setFront(e.target.value)}
        onBlur={() => front !== card.front && onSave({ front })}
        placeholder="Front"
        className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none dark:border-white/20"
      />
      <textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        onBlur={() => back !== card.back && onSave({ back })}
        placeholder="Back"
        rows={2}
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none dark:border-white/20"
      />
    </li>
  );
}

function AddFlashcardForm({ requirements, onSubmit, onCancel }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [selected, setSelected] = useState([]);

  return (
    <div className="mb-3 rounded-md border border-dashed border-black/20 p-3 dark:border-white/25">
      <input
        value={front}
        onChange={(e) => setFront(e.target.value)}
        placeholder="Front"
        className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none dark:border-white/20"
      />
      <textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        placeholder="Back"
        rows={2}
        className="mb-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none dark:border-white/20"
      />
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
          onClick={() => front.trim() && back.trim() && onSubmit(front, back, selected)}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
        >
          Add flashcard
        </button>
        <button onClick={onCancel} className="rounded-md border border-black/15 px-3 py-1.5 text-xs dark:border-white/20">
          Cancel
        </button>
      </div>
    </div>
  );
}
