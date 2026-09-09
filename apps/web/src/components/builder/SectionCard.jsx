"use client";

export function SectionCard({ title, badge, actions, children }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-black/10 p-5 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">{title}</h2>
          {badge}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function RegenerateButton({ onClick, disabled, label = "Regenerate" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
    >
      {disabled ? "Regenerating…" : label}
    </button>
  );
}

export function StateBadge({ state }) {
  const style =
    state === "pinned"
      ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
      : state === "edited"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
        : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${style}`}>{state}</span>;
}
