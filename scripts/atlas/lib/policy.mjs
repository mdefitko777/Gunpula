// Crawl-policy status of the hosts the Gundam pipeline reads. The build copies it into the
// "sources" entry of every Fandom-derived output so the app and its users can see it.
//
// Fandom (gundam.fandom.com, gunpla.fandom.com): robots.txt could not be read. Both hosts answer
// /robots.txt with HTTP 403 and a Cloudflare "Just a moment" challenge to our bot user agent
// (checked 2026-10-31 by the verifier and again 2026-11-01). We do not solve challenges or
// pretend to be a browser, so the rules for /api.php are unknown. Fetching from Fandom is
// therefore OFF until a human has confirmed the policy (for example by reading robots.txt in
// a browser) and opts in with ATLAS_FANDOM_CONFIRMED=1 (repository variable of the same name
// for the scheduled workflow). Until then the committed snapshots are used unchanged.

export const FANDOM_CONFIRMED = process.env.ATLAS_FANDOM_CONFIRMED === "1";

export const FANDOM_POLICY = {
  robots_txt: "unverified",
  checked_at: "2026-11-01",
  detail:
    "robots.txt on gundam.fandom.com and gunpla.fandom.com returns HTTP 403 with a Cloudflare challenge to HobbyAtlasDataBot/1.0, so the /api.php rules could not be read. Automatic fetching stays off until a human confirms the policy (ATLAS_FANDOM_CONFIRMED=1); the committed snapshots are used meanwhile.",
};

/** Throw unless Fandom fetching was confirmed by a human (offline cache-only runs are allowed). */
export function assertFandomAllowed(host) {
  if (FANDOM_CONFIRMED || process.env.ATLAS_OFFLINE === "1") return;
  throw new Error(`${host}: fetching is disabled until a human confirms the Fandom robots/API policy (set ATLAS_FANDOM_CONFIRMED=1)`);
}

/** Attach the policy note to Fandom source entries. */
export function withCrawlPolicy(source) {
  return /fandom\.com/.test(String(source?.url || "")) ? { ...source, crawl_policy: { ...FANDOM_POLICY, fetch_enabled: FANDOM_CONFIRMED } } : source;
}
