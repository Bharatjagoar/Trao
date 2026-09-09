"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

export function CreateKitForm({ onCreated }) {
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [batchStatus, setBatchStatus] = useState(null);
  const fileInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createKit({ jd, companyUrl, days });
      setJd("");
      setCompanyUrl("");
      setDays(5);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start generation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBatchStatus("Reading file…");
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      if (!Array.isArray(raw) || raw.length === 0) throw new Error("File must contain a JSON array of cases.");
      const cases = raw.map((c) => ({
        jd: c.jd,
        companyUrl: c.company_url ?? c.companyUrl ?? "",
        days: c.days ?? 5,
      }));
      setBatchStatus(`Submitting ${cases.length} case(s)…`);
      await api.createBatch(cases);
      setBatchStatus(`Started ${cases.length} kit(s). They'll appear below as they progress.`);
      onCreated();
    } catch (err) {
      setBatchStatus(null);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? `Could not read that file: ${err.message}`
            : "Could not read that file."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-black/10 p-5 dark:border-white/10">
      <h2 className="font-medium">Create a new kit</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jd" className="text-sm font-medium">
            Job description
          </label>
          <textarea
            id="jd"
            required
            rows={6}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="companyUrl" className="text-sm font-medium">
              Company website
            </label>
            <input
              id="companyUrl"
              type="url"
              required
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://company.com"
              className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="days" className="text-sm font-medium">
              Days until interview
            </label>
            <input
              id="days"
              type="number"
              min={1}
              max={90}
              required
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Starting…" : "Generate kit"}
        </button>
      </form>

      <div className="border-t border-black/10 pt-4 dark:border-white/10">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Preparing for multiple roles? Upload a JSON file</span>
          <span className="text-black/50 dark:text-white/50">
            An array of {"{ jd, company_url, days }"} objects — the same shape used by the batch evaluate command.
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFile}
            className="mt-1 text-sm"
          />
        </label>
        {batchStatus && <p className="mt-2 text-sm text-black/60 dark:text-white/60">{batchStatus}</p>}
      </div>
    </div>
  );
}
