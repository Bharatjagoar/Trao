"use client";

import { SectionCard } from "./SectionCard";

const PRIORITY_STYLE = {
  must: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  nice: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60",
};

export function RequirementsSection({ kit }) {
  const uncovered = new Set(kit.coverage.uncovered_requirement_ids);

  return (
    <SectionCard
      title="Requirements"
      badge={
        <span className="text-xs text-black/50 dark:text-white/50">
          extracted from the job description — {kit.role.requirements.length} found
        </span>
      }
    >
      {kit.role.requirements.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No clear requirements could be extracted from this job description.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {kit.role.requirements.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_STYLE[r.priority]}`}>
                {r.priority}
              </span>
              <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase text-black/50 dark:bg-white/10 dark:text-white/50">
                {r.kind}
              </span>
              <span className="flex-1">{r.text}</span>
              {uncovered.has(r.id) && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  no question yet
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
