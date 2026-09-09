import { safeFetch } from "../security/fetchSafe.js";
import { isAllowedByRobots } from "../security/robots.js";
import { cleanHtml } from "./pageCleaner.js";
import { sleep } from "../util/retry.js";

const HIRING_KEYWORDS = [
  "career",
  "careers",
  "job",
  "jobs",
  "hiring",
  "join-us",
  "join us",
  "work-with-us",
  "life-at",
  "culture",
  "interview",
  "handbook",
  "engineering-blog",
  "recruiting",
  "openings",
  "positions",
];

const ABOUT_KEYWORDS = ["about", "company", "mission", "who-we-are", "our-story", "team"];

const MAX_PAGES = 12;
const MAX_LINKS_PER_PAGE = 6;
const CRAWL_DELAY_MS = 350;

function scoreAgainst(link, keywords) {
  const hay = `${link.href} ${link.text}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (hay.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Crawls a company site breadth-first from its homepage, ranking discovered
 * links by keyword relevance rather than assuming a fixed path like
 * /careers. Same-origin only, robots.txt-respecting, rate-limited, and
 * every unreachable page is recorded rather than treated as a fatal error.
 */
export async function crawlCompanySite(startUrl, options = {}) {
  const origin = new URL(startUrl).origin;
  const visited = new Set();
  const queue = [startUrl];
  const skipped = [];
  const pagesUsed = [];

  let homepagePage = null;
  let bestHiring = null;
  let bestAbout = null;

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    const allowed = await isAllowedByRobots(url, {
      allowPrivateNetworks: options.allowPrivateNetworks,
    }).catch(() => true);
    if (!allowed) {
      skipped.push({ url, reason: "ROBOTS_DISALLOWED" });
      continue;
    }

    if (visited.size > 1) await sleep(CRAWL_DELAY_MS);

    const res = await safeFetch(url, { allowPrivateNetworks: options.allowPrivateNetworks });
    if (!res.ok || !res.body) {
      skipped.push({ url, reason: res.reason ?? "FETCH_FAILED" });
      continue;
    }

    const page = cleanHtml(res.body, url);
    pagesUsed.push(url);
    if (!homepagePage) homepagePage = page;

    const hiringScore = scoreAgainst({ href: url, text: page.title }, HIRING_KEYWORDS);
    if (hiringScore > 0 && (!bestHiring || hiringScore > bestHiring.score)) {
      bestHiring = { url, score: hiringScore, page };
    }

    const aboutScore = scoreAgainst({ href: url, text: page.title }, ABOUT_KEYWORDS);
    if (aboutScore > 0 && (!bestAbout || aboutScore > bestAbout.score)) {
      bestAbout = { url, score: aboutScore, page };
    }

    const ranked = rankLinks(page.links, origin, visited, queue);
    for (const link of ranked.slice(0, MAX_LINKS_PER_PAGE)) {
      queue.push(link.href);
    }
  }

  return {
    homepageUrl: startUrl,
    pagesUsed,
    aboutText: bestAbout?.page.text ?? homepagePage?.text ?? "",
    aboutSourceUrl: bestAbout?.url ?? (homepagePage ? startUrl : undefined),
    hiringPageUrl: bestHiring?.url,
    hiringText: bestHiring?.page.text,
    skipped,
  };
}

function rankLinks(links, origin, visited, queued) {
  const queuedSet = new Set(queued);
  return links
    .filter((l) => {
      try {
        return new URL(l.href).origin === origin;
      } catch {
        return false;
      }
    })
    .filter((l) => !visited.has(l.href) && !queuedSet.has(l.href))
    .map((l) => ({
      link: l,
      score: Math.max(
        scoreAgainst(l, HIRING_KEYWORDS) * 2,
        scoreAgainst(l, ABOUT_KEYWORDS)
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.link);
}
