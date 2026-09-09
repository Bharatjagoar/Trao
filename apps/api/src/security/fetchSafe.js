import { validateExternalUrl } from "./urlValidation.js";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB cap on any single fetched page
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];
const FETCH_TIMEOUT_MS = 10_000;

/**
 * A fetch wrapper for untrusted, external pages. Validates the URL (SSRF
 * guard), restricts to http(s) content pages, enforces a hard size cap, and
 * times out. Callers must still treat the returned body as untrusted content
 * — never as instructions — when passing it to the LLM.
 */
export async function safeFetch(urlString, options = {}) {
  const validation = await validateExternalUrl(urlString, {
    allowPrivateNetworks: options.allowPrivateNetworks,
  });
  if (!validation.ok || !validation.url) {
    return { ok: false, reason: validation.reason ?? "URL_INVALID" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(validation.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          options.userAgent ?? "TraoInterviewPrepBot/1.0 (+research; respects robots.txt)",
      },
    });

    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const isAllowedType =
      contentType === "" || ALLOWED_CONTENT_TYPES.some((t) => contentType.startsWith(t));
    if (!isAllowedType) {
      return { ok: false, status: res.status, contentType, reason: "UNSUPPORTED_CONTENT_TYPE" };
    }

    const declaredLength = res.headers.get("content-length");
    if (declaredLength && Number(declaredLength) > MAX_BYTES) {
      return { ok: false, status: res.status, reason: "CONTENT_TOO_LARGE" };
    }

    if (!res.ok) {
      return { ok: false, status: res.status, reason: `HTTP_${res.status}` };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { ok: true, status: res.status, contentType, body: text.slice(0, MAX_BYTES) };
    }

    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        await reader.cancel();
        return { ok: false, status: res.status, reason: "CONTENT_TOO_LARGE" };
      }
      chunks.push(value);
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    return { ok: true, status: res.status, contentType, body };
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "TIMEOUT" : "FETCH_FAILED";
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}
