"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { CreateKitForm } from "@/components/CreateKitForm";
import { KitList } from "@/components/KitList";
import { api } from "@/lib/api";

function DashboardContent() {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { kits } = await api.listKits();
      setKits(kits);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const hasInFlight = kits.some((k) => k.status === "pending" || k.status === "generating");
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [kits, load]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <CreateKitForm onCreated={load} />
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Your kits</h2>
        {loading ? (
          <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>
        ) : (
          <KitList kits={kits} onChanged={load} />
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
