// robots.txt for this project's polite crawlers (RFC 9309, the parts they need), shared by
// backfill_release_dates.mjs, pb_gallery.mjs and import_bandai_manuals.mjs:
//   * a group is one or more consecutive User-agent lines followed by its rules; it
//     applies when any of its agents matches (comments, blank lines and other records
//     such as Sitemap do not end the agent list, only a rule line does);
//   * the groups naming this bot win over "*"; several matching groups are combined;
//   * "*" in a rule matches any characters, "$" at the end anchors the end of the path;
//   * the longest matching rule wins, Allow on a tie; an empty "Disallow:" allows all;
//   * robots.txt answering 4xx (none published) = everything allowed, 5xx or no answer
//     (timeout, DNS, connection) = everything disallowed for this run (§2.3.1.3–4).
//     429 is the site asking us to slow down, so it counts as unreachable, not as "none".

export const BOT_TOKEN = "hobbyatlasdatabot";

/** robots.txt path rule → RegExp: `*` = any characters, `$` at the end = end of the path. */
export function robotsPattern(rule) {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** "HobbyAtlasDataBot/1.0" and "hobbyatlasdatabot" name the same product token. */
const agentToken = (value) => value.split("/")[0].trim().toLowerCase();

/**
 * robots.txt text → { rules: [{ allow, path }], group } for `agent` (its own groups if
 * any, otherwise the "*" groups; group says which, or "none").
 */
export function parseRobots(text, agent = BOT_TOKEN) {
  const groups = [];
  let current = null;
  let inAgents = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!inAgents) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(agentToken(value));
      inAgents = true;
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    inAgents = false;
    if (current && value) current.rules.push({ allow: key === "allow", path: value });
  }
  const token = agentToken(agent);
  const own = groups.filter((group) => group.agents.includes(token));
  const chosen = own.length ? own : groups.filter((group) => group.agents.includes("*"));
  return { rules: chosen.flatMap((group) => group.rules), group: own.length ? token : chosen.length ? "*" : "none" };
}

/**
 * May this bot read `target` (an absolute URL, or a "/path?query")? `robots` comes from
 * parseRobots / loadRobots. Rules are matched against the raw and the percent-decoded path.
 */
export function robotsAllows(robots, target) {
  if (!robots || robots.disallowAll) return false;
  const url = new URL(target, "https://robots.invalid");
  const raw = `${url.pathname}${url.search}`;
  if (url.pathname === "/robots.txt") return true;
  const targets = [raw];
  try {
    targets.push(decodeURIComponent(raw));
  } catch {
    // malformed escapes: the raw form only
  }
  let best = null;
  for (const rule of robots.rules || []) {
    const re = robotsPattern(rule.path);
    if (!targets.some((t) => re.test(t))) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

/**
 * Reads https://<host>/robots.txt with this bot's user-agent and never throws:
 * { rules, group, disallowAll?, status } (status is a short line for the log).
 */
export async function loadRobots(host, { userAgent, timeoutMs = 15000, fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(`https://${host}/robots.txt`, {
      headers: userAgent ? { "User-Agent": userAgent } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 429 || response.status >= 500) {
      return { rules: [], group: "none", disallowAll: true, status: `${response.status} (unreachable: disallow all)` };
    }
    if (response.status >= 400) return { rules: [], group: "none", status: `${response.status} (no robots.txt: all allowed)` };
    if (!response.ok) {
      // A redirect that was not followed (or any other non-2xx): the rules were never read.
      return { rules: [], group: "none", disallowAll: true, status: `${response.status} (not read: disallow all)` };
    }
    const robots = parseRobots(await response.text());
    const disallows = robots.rules.filter((rule) => !rule.allow).length;
    return { ...robots, status: `${response.status} (rules for ${robots.group}: ${disallows} disallow)` };
  } catch (error) {
    return { rules: [], group: "none", disallowAll: true, status: `error (${error.message}): disallow all` };
  }
}
