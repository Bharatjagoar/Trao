"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";

const CONFIDENCE_LABELS = ["No idea", "Shaky", "OK", "Good", "Nailed it"];

function PracticeContent({ id }) {
  const [kit, setKit] = useState(null);
  const [order, setOrder] = useState([]);
  const [covered, setCovered] = useState(0);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    const next = await api.nextPractice(id);
    setOrder(next.order);
    setCovered(next.covered);
    setTotal(next.total);
    setIndex(0);
    setRevealed(false);
  }, [id]);

  useEffect(() => {
    async function init() {
      try {
        const doc = await api.getKit(id);
        if (!doc.kit) throw new ApiError("This kit is not ready yet.", "NOT_READY", 409);
        setKit(doc.kit);
        await loadOrder();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load practice mode.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id, loadOrder]);

  async function handleConfidence(confidence) {
    const cardId = order[index];
    try {
      await api.recordPractice(id, cardId, confidence);
    } catch {
      // Non-fatal — still advance locally so the session isn't blocked.
    }
    if (index + 1 >= order.length) {
      await loadOrder();
    } else {
      setIndex((i) => i + 1);
      setRevealed(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-xl p-6 text-sm text-black/50 dark:text-white/50">Loading…</div>;
  if (error) return <div className="mx-auto max-w-xl p-6 text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!kit) return null;

  if (kit.flashcards.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm">This kit has no flashcards yet.</p>
        <Link href={`/kit/${id}`} className="text-sm underline">
          Back to the kit
        </Link>
      </div>
    );
  }

  const cardId = order[index];
  const card = kit.flashcards.find((c) => c.id === cardId);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href={`/kit/${id}`} className="text-sm underline">
          ← Back to kit
        </Link>
        <span className="text-sm text-black/50 dark:text-white/50">
          {covered}/{total} covered
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full bg-black transition-all dark:bg-white"
          style={{ width: total > 0 ? `${(covered / total) * 100}%` : "0%" }}
        />
      </div>

      {card && (
        <div className="flex min-h-64 flex-col items-center justify-center gap-6 rounded-lg border border-black/10 p-8 text-center dark:border-white/10">
          <p className="text-lg font-medium">{card.front}</p>
          {revealed ? (
            <p className="text-black/70 dark:text-white/70">{card.back}</p>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
            >
              Show answer
            </button>
          )}
        </div>
      )}

      {revealed && (
        <div>
          <p className="mb-2 text-center text-xs text-black/50 dark:text-white/50">
            How confident did you feel?
          </p>
          <div className="grid grid-cols-5 gap-2">
            {CONFIDENCE_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => handleConfidence(i + 1)}
                className="rounded-md border border-black/15 px-2 py-2 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {i + 1}
                <br />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-black/40 dark:text-white/40">
        Card {index + 1} of {order.length} this round — ordered by lowest confidence first.
      </p>
    </div>
  );
}

export default function PracticePage({ params }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <PracticeContent id={id} />
    </RequireAuth>
  );
}
