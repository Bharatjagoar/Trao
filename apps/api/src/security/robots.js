import robotsParser from "robots-parser";
import { safeFetch } from "./fetchSafe.js";

const cache = new Map();

/**
 * Respects robots.txt for crawling. A missing or unreachable robots.txt is
 * treated as "allow" (the conventional default); a present robots.txt is
 * parsed and consulted for every subsequent path on that host.
 */
export async function isAllowedByRobots(urlString, options = {}) {
  const url = new URL(urlString);
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  const userAgent = options.userAgent ?? "TraoInterviewPrepBot";

  if (!cache.has(robotsUrl)) {
    const res = await safeFetch(robotsUrl, { allowPrivateNetworks: options.allowPrivateNetworks });
    cache.set(robotsUrl, res.ok && res.body ? robotsParser(robotsUrl, res.body) : null);
  }

  const robots = cache.get(robotsUrl);
  if (!robots) return true;
  return robots.isAllowed(urlString, userAgent) ?? true;
}

export function clearRobotsCache() {
  cache.clear();
}
