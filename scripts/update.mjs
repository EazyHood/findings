// Rebuilds RECORD.md, data/record.json and the totals block in README.md from the
// GitHub search API. Runs on a schedule in Actions; no local machine involved.
//
// Design note: this script does NOT touch the curated tables in README.md. Those
// descriptions are hand-written and are the part worth reading. It only owns the
// region between the AUTO:TOTALS markers, plus the two generated files.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import process from "node:process";

const USER = process.env.FINDINGS_USER ?? "EazyHood";
const TOKEN = process.env.GITHUB_TOKEN;
const SEARCH_CAP = 1000; // GitHub's hard ceiling on search results

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${USER}-findings-updater`,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, { headers });
    if (response.ok) return response.json();
    // 403 here is nearly always secondary rate limiting, which clears on its own.
    if ((response.status === 403 || response.status === 429) && attempt < 4) {
      const wait = attempt * 20_000;
      console.log(`  ${response.status} on attempt ${attempt}, waiting ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
}

async function searchAll(type) {
  const items = [];
  let declared = null;
  for (let page = 1; page <= 10; page++) {
    const url = `https://api.github.com/search/issues?q=author:${USER}+type:${type}&per_page=100&page=${page}`;
    const data = await api(url);
    declared ??= data.total_count;
    items.push(...data.items);
    if (items.length >= declared || data.items.length === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { items, declared };
}

function repoOf(item) {
  return item.repository_url.split("/repos/")[1];
}

console.log(`Collecting the public record for ${USER}`);
const prs = await searchAll("pr");
const issues = await searchAll("issue");

// --- Guards -----------------------------------------------------------------
// A source that always returns something returning nothing is an exception, not
// a result. Fail loudly rather than committing a README that claims zero.
if (prs.items.length === 0 && issues.items.length === 0) {
  console.error("ERROR: the search returned nothing at all. Refusing to write.");
  process.exit(1);
}

let previous = null;
try {
  previous = JSON.parse(await readFile("data/record.json", "utf8"));
} catch {
  console.log("No previous record, treating this as the first run.");
}

const totals = {
  generatedAt: new Date().toISOString().slice(0, 10),
  prsOpened: prs.items.length,
  prsMerged: prs.items.filter((x) => x.pull_request?.merged_at).length,
  issuesOpened: issues.items.length,
  issuesClosed: issues.items.filter((x) => x.state === "closed").length,
  organizations: new Set([...prs.items, ...issues.items].map((x) => repoOf(x).split("/")[0])).size,
  truncated: prs.declared >= SEARCH_CAP || issues.declared >= SEARCH_CAP,
};

// The record only grows. A large drop means a partial response, not lost work.
if (previous) {
  for (const key of ["prsOpened", "prsMerged", "issuesOpened"]) {
    const before = previous.totals[key];
    if (totals[key] < before * 0.9) {
      console.error(
        `ERROR: ${key} fell from ${before} to ${totals[key]}. That is a partial ` +
          `response, not a real change. Refusing to write.`,
      );
      process.exit(1);
    }
  }
}

// --- The honest caveat, computed rather than hardcoded -----------------------
const mergedByRepo = {};
for (const pr of prs.items.filter((x) => x.pull_request?.merged_at)) {
  mergedByRepo[repoOf(pr)] = (mergedByRepo[repoOf(pr)] ?? 0) + 1;
}
const topTwo = Object.entries(mergedByRepo)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 2);
const concentrated = topTwo.reduce((sum, [, count]) => sum + count, 0);

const caveat =
  `Two honest notes on those totals. First, ${concentrated} of the ${totals.prsMerged} merges come ` +
  `from two high-volume repositories (\`${topTwo[0]?.[0]}\` and \`${topTwo[1]?.[0]}\`) where the ` +
  `work was individually small — the range is better shown by the other ${totals.prsMerged - concentrated}. ` +
  `Second, ${totals.issuesOpened - totals.issuesClosed} of the ${totals.issuesOpened} issues are ` +
  `still open, which is ordinary for issues filed against large projects and is not evidence of ` +
  `anything either way.`;

const block = [
  `**Totals as of ${totals.generatedAt}:** ${totals.prsOpened} pull requests opened, ` +
    `**${totals.prsMerged} merged**; ${totals.issuesOpened} issues opened, ${totals.issuesClosed} ` +
    `closed. Across ${totals.organizations} organizations. The complete list is in ` +
    `[RECORD.md](RECORD.md), regenerated automatically.`,
  "",
  caveat,
  totals.truncated
    ? "\n> Note: the GitHub search API caps at 1,000 results and that ceiling has been reached, so " +
      "these totals are a floor rather than a count."
    : "",
]
  .join("\n")
  .trimEnd();

// --- Write -------------------------------------------------------------------
const readme = await readFile("README.md", "utf8");
const START = "<!-- AUTO:TOTALS -->";
const END = "<!-- /AUTO:TOTALS -->";
if (!readme.includes(START) || !readme.includes(END)) {
  console.error(`ERROR: README.md is missing the ${START} / ${END} markers.`);
  process.exit(1);
}
const before = readme.slice(0, readme.indexOf(START) + START.length);
const after = readme.slice(readme.indexOf(END));
await writeFile("README.md", `${before}\n${block}\n${after}`, "utf8");

const byRepo = {};
for (const item of [...prs.items, ...issues.items]) {
  (byRepo[repoOf(item)] ??= []).push(item);
}

const state = (item) => {
  if (item.pull_request?.merged_at) return "**merged**";
  if (item.pull_request) return item.state === "closed" ? "closed unmerged" : "open";
  return item.state === "closed" ? "closed" : "open";
};

const record = [
  "# The complete record",
  "",
  "Every public issue and pull request authored by " +
    `[@${USER}](https://github.com/${USER}), newest first within each project.`,
  "",
  `Generated automatically on ${totals.generatedAt}. Do not edit by hand: ` +
    "`scripts/update.mjs` overwrites this file.",
  "",
  ...Object.entries(byRepo)
    .sort((a, b) => b[1].length - a[1].length)
    .flatMap(([repo, items]) => [
      `## ${repo}`,
      "",
      "| | Title | State |",
      "| --- | --- | --- |",
      ...items
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(
          (item) =>
            `| [#${item.number}](${item.html_url}) | ${item.title.replace(/\|/g, "\\|")} | ${state(item)} |`,
        ),
      "",
    ]),
].join("\n");
await writeFile("RECORD.md", `${record}\n`, "utf8");

await mkdir("data", { recursive: true });
await writeFile(
  "data/record.json",
  `${JSON.stringify(
    {
      totals,
      items: [...prs.items, ...issues.items]
        .map((item) => ({
          repo: repoOf(item),
          number: item.number,
          title: item.title,
          url: item.html_url,
          state: item.state,
          merged: Boolean(item.pull_request?.merged_at),
          isPullRequest: Boolean(item.pull_request),
          createdAt: item.created_at,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  `Done. ${totals.prsOpened} PRs (${totals.prsMerged} merged), ` +
    `${totals.issuesOpened} issues, ${totals.organizations} organizations.`,
);
