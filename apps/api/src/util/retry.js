/**
 * Exponential backoff with jitter. Used for both the LLM client and the
 * search client so a provider rate-limit ("slow down") degrades into a
 * retry instead of crashing the pipeline.
 */
export async function withRetry(fn, opts = {}) {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = opts.isRetryable ? opts.isRetryable(err) : true;
      if (!retryable || attempt === retries) break;
      const delay = baseDelay * 2 ** attempt + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
