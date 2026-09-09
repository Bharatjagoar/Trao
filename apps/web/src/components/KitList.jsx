"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

const STATUS_LABEL = {
  pending: "Queued",
  generating: "Generating…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  generating: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function KitList({ kits, onChanged }) {
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.deleteKit(id);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  if (kits.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        No kits yet. Create one above to get started.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {kits.map((kit) => (
        <li
          key={kit.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 dark:border-white/10"
        >
          <Link href={`/kit/${kit.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{kit.title}</p>
            <p className="text-xs text-black/50 dark:text-white/50">
              {new Date(kit.createdAt).toLocaleString()}
            </p>
          </Link>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[kit.status]}`}>
            {STATUS_LABEL[kit.status]}
          </span>
          <button
            onClick={() => handleDelete(kit.id)}
            disabled={deletingId === kit.id}
            aria-label={`Delete kit ${kit.title}`}
            className="shrink-0 rounded-md border border-black/10 px-2.5 py-1.5 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
