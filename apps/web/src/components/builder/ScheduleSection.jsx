"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { RegenerateButton, SectionCard, StateBadge } from "./SectionCard";

export function ScheduleSection({ kitId, kit, meta, onUpdated }) {
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const questionById = new Map(kit.questions.map((q) => [q.id, q]));

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const { kit: updated, meta: updatedMeta } = await api.regenerate(kitId, "schedule");
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <SectionCard
      title={`Schedule — ${kit.schedule.days_available} day${kit.schedule.days_available === 1 ? "" : "s"}`}
      badge={<StateBadge state={meta.schedule.state} />}
      actions={<RegenerateButton onClick={handleRegenerate} disabled={regenerating} />}
    >
      {meta.schedule.state === "edited" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          The schedule was edited — regenerating will rebuild it from the current questions.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ol className="flex flex-col gap-3">
        {kit.schedule.days.map((day) => (
          <li key={day.day} className="rounded-md border border-black/10 p-3 dark:border-white/10">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Day {day.day}: {day.focus || "—"}</span>
              <span className="text-xs text-black/50 dark:text-white/50">{day.minutes} min</span>
            </div>
            {day.question_ids.length === 0 ? (
              <p className="text-xs text-black/40 dark:text-white/40">No new questions — review previous days.</p>
            ) : (
              <ul className="list-inside list-disc text-xs text-black/60 dark:text-white/60">
                {day.question_ids.map((qid) => (
                  <li key={qid}>{questionById.get(qid)?.prompt ?? qid}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
