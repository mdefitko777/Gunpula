import assert from "node:assert/strict";
import { loadRobots, parseRobots, robotsAllows, robotsPattern } from "./lib/robots.mjs";

// Path patterns: "*" = any characters, "$" = end of the path
assert.equal(robotsPattern("/*reminder*").test("/itemDcBbdEvv.html"), false);
assert.equal(robotsPattern("/*reminder*").test("/mypage/reminder-list"), true);
assert.equal(robotsPattern("/cart").test("/cart?x=1"), true);
assert.equal(robotsPattern("/a.html$").test("/a.html"), true);
assert.equal(robotsPattern("/a.html$").test("/a.html?x"), false);
assert.equal(robotsPattern("/a.b").test("/axb"), false, "a dot is literal");

// One group, several User-agent lines: the group applies when any of them matches.
// (The old parser let "Googlebot" switch the "*" group off and dropped "/item".)
const multi = parseRobots("User-agent: *\nUser-agent: Googlebot\nDisallow: /item\n");
assert.equal(multi.group, "*");
assert.equal(robotsAllows(multi, "/itemDcBbdEvv.html"), false);
assert.equal(robotsAllows(multi, "/top"), true);

// Comments, blank lines and Sitemap between the agent lines do not split the group
const spaced = parseRobots("User-agent: Googlebot # search\n\nSitemap: https://x/s.xml\nUser-agent: *\nDisallow: /private\n");
assert.equal(robotsAllows(spaced, "/private/a"), false);

// A rule line ends the agent list: the next User-agent starts a new group
const twoGroups = parseRobots("User-agent: *\nDisallow: /a\nUser-agent: Googlebot\nDisallow: /b\n");
assert.equal(robotsAllows(twoGroups, "/a"), false);
assert.equal(robotsAllows(twoGroups, "/b"), true, "Googlebot's rule is not ours");

// This bot's own group wins over "*" (any case, a version suffix is ignored); its groups combine
const own = parseRobots(
  "User-agent: *\nDisallow: /\n\nUser-agent: HobbyAtlasDataBot/1.0\nDisallow: /cart\n\nUser-agent: hobbyatlasdatabot\nDisallow: /member\n",
);
assert.equal(own.group, "hobbyatlasdatabot");
assert.equal(robotsAllows(own, "/item1.html"), true);
assert.equal(robotsAllows(own, "/cart"), false);
assert.equal(robotsAllows(own, "/member/login"), false);

// Longest match wins; Allow wins a tie; an empty Disallow allows everything
const longest = parseRobots("User-agent: *\nDisallow: /bc/\nAllow: /bc/img/\nDisallow: /bc/img/model/xl/\nAllow: /tie\nDisallow: /tie\n");
assert.equal(robotsAllows(longest, "/bc/x"), false);
assert.equal(robotsAllows(longest, "/bc/img/model/s/1000252948_2.jpg"), true);
assert.equal(robotsAllows(longest, "/bc/img/model/xl/1000252948_2.jpg"), false);
assert.equal(robotsAllows(longest, "/tie"), true);
assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow:\n"), "/anything"), true);
assert.equal(robotsAllows(parseRobots("User-agent: Googlebot\nDisallow: /\n"), "/anything"), true, "no group for us or *");

// Wildcards and "$", against a full URL with its query
const wild = parseRobots("User-agent: *\nDisallow: /*?sort=\nDisallow: /*.pdf$\n");
assert.equal(robotsAllows(wild, "https://manual.bandai-hobby.net/?page=3"), true);
assert.equal(robotsAllows(wild, "https://manual.bandai-hobby.net/list?sort=new"), false);
assert.equal(robotsAllows(wild, "/menus/a.pdf"), false);
assert.equal(robotsAllows(wild, "/menus/a.pdf?x=1"), true);

// Percent-encoded paths match a rule written in plain text
assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow: /説明書\n"), "https://x.jp/%E8%AA%AC%E6%98%8E%E6%9B%B8/1"), false);
// robots.txt itself is always allowed
assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow: /\n"), "/robots.txt"), true);

// Fetching: 4xx = none published (allow all); 5xx, 429 or no answer = disallow all for the run
const fakeFetch = (status, body = "") => async (url, options) => {
  assert.equal(url, "https://example.jp/robots.txt");
  assert.equal(options.headers["User-Agent"], "TestBot/1.0");
  return new Response(body, { status });
};
const ua = { userAgent: "TestBot/1.0" };
const ok = await loadRobots("example.jp", { ...ua, fetchImpl: fakeFetch(200, "User-agent: *\nUser-agent: Googlebot\nDisallow: /item\n") });
assert.equal(ok.disallowAll, undefined);
assert.equal(robotsAllows(ok, "/item1"), false);
assert.equal(robotsAllows(ok, "/other"), true);
for (const status of [404, 410, 403]) {
  const none = await loadRobots("example.jp", { ...ua, fetchImpl: fakeFetch(status) });
  assert.equal(robotsAllows(none, "/anything"), true, `robots.txt ${status}: allow all`);
}
for (const status of [500, 502, 503, 429]) {
  const down = await loadRobots("example.jp", { ...ua, fetchImpl: fakeFetch(status) });
  assert.equal(down.disallowAll, true, `robots.txt ${status}: disallow all`);
  assert.equal(robotsAllows(down, "/anything"), false);
}
const unreachable = await loadRobots("example.jp", {
  ...ua,
  fetchImpl: async () => {
    throw new TypeError("fetch failed");
  },
});
assert.equal(unreachable.disallowAll, true, "network error: disallow all");
assert.match(unreachable.status, /fetch failed/);
assert.equal(robotsAllows(null, "/x"), false, "no robots read: nothing allowed");

console.log("robots: ok");
