// The crawling rules of AGENTS.md as one small fetcher, for the importers written since 2026-11-14
// (import_nintendo_korea.mjs, import_bnkr_pokemon.mjs, import_academy_pokemon.mjs): the bot's own
// user agent, robots.txt read once per host before its first page, one request at a time per host
// at least 1.1 s apart, and no second try: 403 / 429 / 503, a bot-check page or a redirect to
// another host (a waiting room) throws, and the importer leaves its data as it was.
//
// Redirects are followed by hand. With redirect: "follow" a jump to another host (a Queue-it
// waiting room, a login) was already requested before the host check saw it, without that host's
// robots.txt; a same-host redirect is followed after the robots.txt check of its new path.
// A host that refused (403 / 429 / 503 / bot check / sent us elsewhere) gets no further request
// from this fetcher for the run, whatever the caller does next.
import { looksLikeBotChallenge } from "../atlas/lib/http.mjs";
import { loadRobots, robotsAllows } from "./robots.mjs";

export const BOT_USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const MAX_REDIRECTS = 5;
const STOP_STATUSES = new Set([403, 429, 503]);

export function createPoliteFetcher({ userAgent = BOT_USER_AGENT, gapMs = 1100, language = "ko-KR,ko;q=0.9", fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const lastRequestAt = new Map();
  const robotsByHost = new Map();
  const stoppedHosts = new Map();
  let requests = 0;

  async function wait(host) {
    const pause = (lastRequestAt.get(host) || 0) + gapMs - Date.now();
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
    lastRequestAt.set(host, Date.now());
  }

  async function checkRobots(host, url) {
    if (!robotsByHost.has(host)) {
      await wait(host);
      const robots = await loadRobots(host, { userAgent, fetchImpl });
      log(`${host}: robots.txt ${robots.status}`);
      robotsByHost.set(host, robots);
    }
    if (!robotsAllows(robotsByHost.get(host), url)) throw new Error(`${url} is disallowed by robots.txt`);
  }

  function stop(host, message) {
    stoppedHosts.set(host, message);
    return new Error(message);
  }

  async function text(url) {
    const host = new URL(url).host;
    if (stoppedHosts.has(host)) throw new Error(`${host} stopped this run (${stoppedHosts.get(host)})`);
    let target = url;
    for (let hops = 0; ; hops += 1) {
      await checkRobots(host, target);
      await wait(host);
      requests += 1;
      const response = await fetchImpl(target, {
        headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml", "Accept-Language": language },
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
      const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
      if (location) {
        const next = new URL(location, target);
        if (next.host !== host) throw stop(host, `${url} was sent to ${next.href}`);
        if (hops >= MAX_REDIRECTS) throw new Error(`${url}: more than ${MAX_REDIRECTS} redirects`);
        target = next.href;
        continue;
      }
      // The site asking us to stop: no retry, the run ends here.
      if (STOP_STATUSES.has(response.status)) throw stop(host, `HTTP ${response.status} for ${target}`);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${target}`);
      const body = await response.text();
      if (looksLikeBotChallenge(response.status, body)) throw stop(host, `${target} answered with a bot check`);
      return body;
    }
  }

  return { text, get requests() { return requests; } };
}
