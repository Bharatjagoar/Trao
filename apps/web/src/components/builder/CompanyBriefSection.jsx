"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { RegenerateButton, SectionCard, StateBadge } from "./SectionCard";

export function CompanyBriefSection({ kitId, kit, meta, onUpdated }) {
  const [summary, setSummary] = useState(kit.company_brief.summary);
  const [whatTheyDo, setWhatTheyDo] = useState(kit.company_brief.what_they_do);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);

  async function saveField(field, value) {
    try {
      const { kit: updated, meta: updatedMeta } = await api.editBrief(kitId, { [field]: value });
      onUpdated(updated, updatedMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the edit.");
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const { kit: updated, meta: updatedMeta } = await api.regenerate(kitId, "company_brief");
      onUpdated(updated, updatedMeta);
      setSummary(updated.company_brief.summary);
      setWhatTheyDo(updated.company_brief.what_they_do);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <SectionCard
      title="Company brief"
      badge={<StateBadge state={meta.company_brief.state} />}
      actions={<RegenerateButton onClick={handleRegenerate} disabled={regenerating} />}
    >
      {meta.company_brief.state === "edited" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          You've edited this brief — regenerating will replace your edit.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-black/50 dark:text-white/50">Summary</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => summary !== kit.company_brief.summary && saveField("summary", summary)}
          rows={3}
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-black/50 dark:text-white/50">What they do</span>
        <textarea
          value={whatTheyDo}
          onChange={(e) => setWhatTheyDo(e.target.value)}
          onBlur={() => whatTheyDo !== kit.company_brief.what_they_do && saveField("what_they_do", whatTheyDo)}
          rows={3}
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
      </div>
      {kit.company_brief.sources.length > 0 && (
        <p className="text-xs text-black/50 dark:text-white/50">
          Sources: {kit.company_brief.sources.slice(0, 3).join(", ")}
          {kit.company_brief.sources.length > 3 ? ` +${kit.company_brief.sources.length - 3} more` : ""}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </SectionCard>
  );
}
