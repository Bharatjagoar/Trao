import * as cheerio from "cheerio";

const MAX_TEXT_CHARS = 20_000;

/**
 * Strips a raw HTML page down to visible text and same-document links. The
 * resulting `text` is treated as untrusted content by every downstream
 * consumer — it is data to summarize, never instructions to follow.
 */
export function cleanHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").first().text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);

  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
      return;
    }
    try {
      const abs = new URL(href, baseUrl).toString();
      links.push({ href: abs, text: $(el).text().replace(/\s+/g, " ").trim() });
    } catch {
      // malformed href, skip
    }
  });

  return { title, text, links };
}
