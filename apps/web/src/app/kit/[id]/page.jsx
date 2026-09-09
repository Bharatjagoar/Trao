"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { CompanyBriefSection } from "@/components/builder/CompanyBriefSection";
import { RequirementsSection } from "@/components/builder/RequirementsSection";
import { QuestionsSection } from "@/components/builder/QuestionsSection";
import { FlashcardsSection } from "@/components/builder/FlashcardsSection";
import { ScheduleSection } from "@/components/builder/ScheduleSection";

function KitBuilderContent({ id }) {
  const [doc, setDoc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getKit(id);
      setDoc(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this kit.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const inFlight = doc?.status === "pending" || doc?.status === "generating";
    if (inFlight && !pollRef.current) {
      pollRef.current = setInterval(load, 2500);
    } else if (!inFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [doc?.status, load]);

  function handleUpdated(kit, meta) {
    setDoc((prev) => (prev ? { ...prev, kit, meta } : prev));
  }

  if (loadError && !doc) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-red-600 dark:text-red-400">{loadError}</div>;
  }

  if (!doc) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-black/50 dark:text-white/50">Loading…</div>;
  }

  if (doc.status === "pending" || doc.status === "generating") {
    return (
      <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />
        <p className="text-sm font-medium">
          {doc.status === "pending" ? "Queued for generation…" : "Researching the company and generating your kit…"}
        </p>
        <p className="max-w-md text-xs text-black/50 dark:text-white/50">
          This crawls the company site, searches for public interview discussion, extracts requirements, generates
          questions per category, then checks and closes coverage gaps. It can take a minute or two.
        </p>
      </div>
    );
  }

  if (doc.status === "failed" || !doc.kit || !doc.meta) {
    return (
      <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Generation failed</p>
        <p className="max-w-md text-xs text-black/60 dark:text-white/60">
          {doc.error?.message ?? "Something went wrong while generating this kit."}
        </p>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const kit = doc.kit;
  const meta = doc.meta;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {kit.role.title} @ {kit.source.company || "Unknown company"}
          </h1>
          <p className="text-sm text-black/50 dark:text-white/50">{kit.role.seniority}</p>
        </div>
        <Link
          href={`/kit/${id}/practice`}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Practice mode
        </Link>
      </div>

      {doc.warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <p className="mb-1 font-medium">Heads up</p>
          <ul className="list-inside list-disc">
            {doc.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {kit.coverage.uncovered_requirement_ids.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {kit.coverage.uncovered_requirement_ids.length} requirement(s) still have no question after{" "}
          {kit.coverage.passes} generation pass(es).
        </div>
      )}

      <CompanyBriefSection kitId={id} kit={kit} meta={meta} onUpdated={handleUpdated} />
      <RequirementsSection kit={kit} />
      <QuestionsSection kitId={id} kit={kit} meta={meta} onUpdated={handleUpdated} />
      <FlashcardsSection kitId={id} kit={kit} meta={meta} onUpdated={handleUpdated} />
      <ScheduleSection kitId={id} kit={kit} meta={meta} onUpdated={handleUpdated} />
    </div>
  );
}

export default function KitBuilderPage({ params }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <KitBuilderContent id={id} />
    </RequireAuth>
  );
}
