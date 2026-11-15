// Picture requests of scripts/cache_catalog_images.mjs, kept apart so scripts/test_image_fetcher.mjs
// can run them against a fake fetch.
//
// Polite mode: the crawling rules of the newer importers — the bot says who it is (no browser
// user-agent, no made-up Referer), robots.txt is read first and obeyed, each host gets one request
// at a time at least gapMs apart, and a host that answers 403 / 429 / 503 or a non-image page (bot
// check) is left alone for the rest of the run; its covers are tried again next run.
//
// The old runs (no --polite) keep their user-agent and Referer (owner's decision), but a host that
// answers 403 / 429 / 503 is not asked again in that run either: on 2026-11-15 the weekly refresh
// asked www.pokemoncenter-online.com once per Pokémon Store Korea record and got three 403s.
export const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const STOP_STATUSES = new Set([403, 429, 503]);

/** --host / --skip-host: only covers on `only` hosts (when given), never covers on `skip` hosts. */
export function hostAllowed(url, { only = new Set(), skip = new Set() } = {}) {
  const { hostname } = new URL(url);
  if (only.size && !only.has(hostname)) return false;
  return !skip.has(hostname);
}

/** "a.example, b.example" → Set of host names. */
export function hostList(value) {
  return new Set(String(value || "").split(",").map((host) => host.trim()).filter(Boolean));
}

export function createImageFetcher({ polite = false, userAgent = BOT_UA, gapMs = 1100, fetchImpl = globalThis.fetch } = {}) {
  const hostState = new Map();

  function stateOf(host) {
    if (!hostState.has(host)) hostState.set(host, { chain: Promise.resolve(), nextAt: 0, robots: undefined, refused: null });
    return hostState.get(host);
  }

  function refusedError(host) {
    return Object.assign(new Error(`host refused earlier: ${stateOf(host).refused}`), { hostRefused: host });
  }

  // Disallow rules for "*" or this bot ("hobbyatlasdatabot"); a robots.txt that is missing or not
  // plain text (a soft-404 page) allows everything.
  async function robotsDisallows(host) {
    const state = stateOf(host);
    if (state.robots === undefined) {
      state.robots = [];
      try {
        const response = await fetchImpl(`https://${host}/robots.txt`, { headers: { "User-Agent": BOT_UA } });
        const text = response.ok && /text\/plain/i.test(response.headers.get("content-type") || "") ? await response.text() : "";
        let applies = false;
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.replace(/#.*/, "").trim();
          const [key, ...rest] = line.split(":");
          const value = rest.join(":").trim();
          if (/^user-agent$/i.test(key)) applies = value === "*" || /hobbyatlasdatabot/i.test(value);
          else if (applies && /^disallow$/i.test(key) && value) state.robots.push(value);
        }
      } catch {
        // unreachable robots.txt: treated as missing
      }
      state.nextAt = Date.now() + gapMs;
    }
    return state.robots;
  }

  async function politeFetch(url) {
    const { host, pathname } = new URL(url);
    const state = stateOf(host);
    const run = async () => {
      if (state.refused) throw refusedError(host);
      const rules = await robotsDisallows(host);
      if (rules.some((rule) => pathname.startsWith(rule))) throw new Error("robots.txt disallows");
      const wait = state.nextAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        const response = await fetchImpl(url, { headers: { "User-Agent": BOT_UA, Accept: "image/*" } });
        const type = response.headers.get("content-type") || "";
        if (STOP_STATUSES.has(response.status) || (response.ok && !/^image\//i.test(type))) {
          state.refused = `HTTP ${response.status} ${type}`;
        }
        return response;
      } finally {
        state.nextAt = Date.now() + gapMs;
      }
    };
    const result = state.chain.then(run, run);
    state.chain = result.catch(() => {});
    return result;
  }

  async function plainFetch(url, referer) {
    const { host } = new URL(url);
    const state = stateOf(host);
    if (state.refused) throw refusedError(host);
    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": userAgent,
        "Referer": referer || new URL(url).origin,
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });
    if (STOP_STATUSES.has(response.status)) state.refused = `HTTP ${response.status}`;
    return response;
  }

  return {
    /** The response for a picture; throws { hostRefused } for a host that refused earlier in the run. */
    fetch: (url, { referer } = {}) => (polite ? politeFetch(url) : plainFetch(url, referer)),
    /** Why the host was stopped this run, or null. */
    refused: (host) => hostState.get(host)?.refused || null,
  };
}
