// The crawling rules of AGENTS.md as one small fetcher, for the importers written since 2026-11-14
// (import_nintendo_korea.mjs, import_bnkr_pokemon.mjs, import_academy_pokemon.mjs): the bot's own
// user agent, robots.txt read once per host before its first page, one request at a time per host
// at least 1.1 s apart, and no second try: 403 / 429 / 503, a bot-check page or a redirect to
// another host (a waiting room) throws, and the importer leaves its data as it was.
import { looksLikeBotChallenge } from "../atlas/lib/http.mjs";
import { loadRobots, robotsAllows } from "./robots.mjs";

export const BOT_USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";

export function createPoliteFetcher({ userAgent = BOT_USER_AGENT, gapMs = 1100, language = "ko-KR,ko;q=0.9", fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const lastRequestAt = new Map();
  const robotsByHost = new Map();
  let requests = 0;

  async function wait(host) {
    const pause = (lastRequestAt.get(host) || 0) + gapMs - Date.now();
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
    lastRequestAt.set(host, Date.now());
  }

  async function text(url) {
    const host = new URL(url).host;
    if (!robotsByHost.has(host)) {
      await wait(host);
      const robots = await loadRobots(host, { userAgent, fetchImpl });
      log(`${host}: robots.txt ${robots.status}`);
      robotsByHost.set(host, robots);
    }
    if (!robotsAllows(robotsByHost.get(host), url)) throw new Error(`${url} is disallowed by robots.txt`);
    await wait(host);
    requests += 1;
    const response = await fetchImpl(url, {
      headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml", "Accept-Language": language },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    // The site asking us to stop: no retry, the run ends here.
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    if (response.url && new URL(response.url).host !== host) throw new Error(`${url} was sent to ${response.url}`);
    const body = await response.text();
    if (looksLikeBotChallenge(response.status, body)) throw new Error(`${url} answered with a bot check`);
    return body;
  }

  return { text, get requests() { return requests; } };
}
