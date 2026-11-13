// RSS 2.0 feeds → items, for the announcement sources that publish one (WordPress
// blogs and magazines, see unofficial-feeds.mjs). Read with patterns like the
// other parsers here: these feeds are machine-written and regular.
import { decodeHtml } from "./bandai-announcements.mjs";

function element(block, tag) {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(block)?.[1] ?? "";
}

// Bodies come as CDATA (WordPress) or entity-escaped; either way the result is HTML.
function htmlBody(value) {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(value);
  if (cdata) return cdata[1];
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/** A time (ms, or a date string such as "2026-11-12T23:15:41+00:00") → "2026-11-13", the day in Japan. */
export function japanDay(value) {
  const time = typeof value === "number" ? value : Date.parse(String(value || "").trim());
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(time));
}

/**
 * Feed text → [{ title, link, guid, date, publishedAt, categories, html }],
 * newest first as the feed has them. `date` is the post's day in Japan,
 * `publishedAt` its time (ISO, or null); `html` is content:encoded, or the
 * description when the feed carries no full text.
 * Null when the text is not a feed (an error or bot-check page).
 */
export function parseRssItems(xml) {
  const text = String(xml || "");
  if (!/<rss[\s>]/.test(text) || !/<channel[\s>]/.test(text)) return null;
  return text.split(/<item(?:\s[^>]*)?>/).slice(1).map((chunk) => {
    const block = chunk.split("</item>")[0];
    const published = Date.parse(decodeHtml(element(block, "pubDate")));
    return {
      title: decodeHtml(element(block, "title")),
      link: decodeHtml(element(block, "link")),
      guid: decodeHtml(element(block, "guid")),
      date: japanDay(published),
      publishedAt: Number.isNaN(published) ? null : new Date(published).toISOString(),
      categories: [...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/g)].map((match) => decodeHtml(match[1])).filter(Boolean),
      html: htmlBody(element(block, "content:encoded") || element(block, "description")),
    };
  });
}
