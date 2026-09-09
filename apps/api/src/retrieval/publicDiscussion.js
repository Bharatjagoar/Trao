import { withRetry } from "../util/retry.js";

/**
 * Searches for public discussion of a company's interview process via
 * Tavily. Absence of an API key or a search that turns up nothing is not an
 * error — it produces an honest "nothing found" result rather than failing
 * the run, per the brief's edge-case handling.
 */
export async function searchPublicDiscussion(companyName) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !companyName.trim()) {
    return { found: false, summary: "", sources: [] };
  }

  const query = `${companyName} interview process questions experience`;

  try {
    const data = await withRetry(
      async () => {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 5,
            search_depth: "basic",
            include_answer: true,
          }),
        });
        if (res.status === 429) throw new Error("RATE_LIMITED");
        if (!res.ok) throw new Error(`TAVILY_HTTP_${res.status}`);
        return await res.json();
      },
      { retries: 2, baseDelayMs: 1500, isRetryable: (e) => e.message === "RATE_LIMITED" }
    );

    const sources = (data.results ?? []).map((r) => r.url).filter(Boolean);
    const summary =
      data.answer?.trim() ||
      (data.results ?? [])
        .map((r) => r.content)
        .join("\n\n")
        .slice(0, 4000);

    return { found: sources.length > 0 || summary.length > 0, summary, sources };
  } catch {
    return { found: false, summary: "", sources: [] };
  }
}
