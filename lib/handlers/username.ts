import { NextRequest, NextResponse } from "next/server";
import { JSON_HEADERS, timedFetch } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Verdict = "found" | "not_found" | "blocked" | "unknown";

interface SiteResult {
  name: string;
  category: string;
  url: string;
  verdict: Verdict;
  reliability: "high" | "medium" | "low";
  note?: string;
}

interface Site {
  name: string;
  category: string;
  reliability: "high" | "medium" | "low";
  profile: (u: string) => string;
  check: (u: string) => Promise<{ verdict: Verdict; note?: string }>;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function grab(url: string, init: RequestInit = {}, ms = 7500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/json,application/xml,text/xml,*/*",
        "accept-language": "en-US,en;q=0.9",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function fromStatus(status: number): Verdict {
  if (status === 200) return "found";
  if (status === 404 || status === 410) return "not_found";
  if (status === 403 || status === 429 || status === 401) return "blocked";
  return "unknown";
}

async function statusOnly(url: string, init: RequestInit = {}, ms = 7500) {
  try {
    const res = await grab(url, init, ms);
    return { verdict: fromStatus(res.status), note: res.status >= 400 ? `HTTP ${res.status}` : undefined };
  } catch (e) {
    return { verdict: "unknown" as Verdict, note: (e as Error).name === "AbortError" ? "timeout" : "unreachable" };
  }
}

const SITES: Site[] = [
  {
    name: "GitHub",
    category: "Code",
    reliability: "high",
    profile: (u) => `https://github.com/${u}`,
    check: (u) => statusOnly(`https://api.github.com/users/${encodeURIComponent(u)}`),
  },
  {
    name: "GitLab",
    category: "Code",
    reliability: "high",
    profile: (u) => `https://gitlab.com/${u}`,
    check: async (u) => {
      try {
        const res = await grab(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(u)}`);
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const rows = (await res.json()) as unknown[];
        return { verdict: rows.length > 0 ? "found" : "not_found" };
      } catch {
        return { verdict: "unknown", note: "unreachable" };
      }
    },
  },
  {
    name: "Bitbucket",
    category: "Code",
    reliability: "high",
    profile: (u) => `https://bitbucket.org/${u}`,
    check: (u) => statusOnly(`https://api.bitbucket.org/2.0/users/${encodeURIComponent(u)}`),
  },
  {
    name: "npm",
    category: "Code",
    reliability: "medium",
    profile: (u) => `https://www.npmjs.com/~${u}`,
    check: (u) => statusOnly(`https://www.npmjs.com/~${encodeURIComponent(u)}`),
  },
  {
    name: "PyPI",
    category: "Code",
    reliability: "medium",
    profile: (u) => `https://pypi.org/user/${u}/`,
    check: (u) => statusOnly(`https://pypi.org/user/${encodeURIComponent(u)}/`),
  },
  {
    name: "Hacker News",
    category: "Community",
    reliability: "high",
    profile: (u) => `https://news.ycombinator.com/user?id=${u}`,
    check: (u) => statusOnly(`https://hn.algolia.com/api/v1/users/${encodeURIComponent(u)}`),
  },
  {
    name: "Reddit",
    category: "Social",
    reliability: "low",
    profile: (u) => `https://reddit.com/user/${u}`,
    check: (u) => statusOnly(`https://www.reddit.com/user/${encodeURIComponent(u)}/about.json`),
  },
  {
    name: "Mastodon",
    category: "Social",
    reliability: "high",
    profile: (u) => `https://mastodon.social/@${u}`,
    check: (u) => statusOnly(`https://mastodon.social/api/v1/accounts/lookup?acct=${encodeURIComponent(u)}`),
  },
  {
    name: "Bluesky",
    category: "Social",
    reliability: "high",
    profile: (u) => `https://bsky.app/profile/${u}.bsky.social`,
    check: (u) =>
      statusOnly(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(u)}.bsky.social`),
  },
  {
    name: "Lichess",
    category: "Games",
    reliability: "high",
    profile: (u) => `https://lichess.org/@/${u}`,
    check: (u) => statusOnly(`https://lichess.org/api/user/${encodeURIComponent(u)}`),
  },
  {
    name: "Chess.com",
    category: "Games",
    reliability: "high",
    profile: (u) => `https://www.chess.com/member/${u}`,
    check: (u) => statusOnly(`https://api.chess.com/pub/player/${encodeURIComponent(u)}`),
  },
  {
    name: "Docker Hub",
    category: "Code",
    reliability: "high",
    profile: (u) => `https://hub.docker.com/u/${u}`,
    check: (u) => statusOnly(`https://hub.docker.com/v2/users/${encodeURIComponent(u)}/`),
  },
  {
    name: "Keybase",
    category: "Identity",
    reliability: "high",
    profile: (u) => `https://keybase.io/${u}`,
    check: async (u) => {
      try {
        const res = await grab(`https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(u)}`);
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const json = (await res.json()) as { them?: unknown[] };
        return { verdict: Array.isArray(json.them) && json.them.length > 0 ? "found" : "not_found" };
      } catch {
        return { verdict: "unknown" };
      }
    },
  },
  {
    name: "Roblox",
    category: "Games",
    reliability: "high",
    profile: (u) => `https://www.roblox.com/search/users?keyword=${u}`,
    check: async (u) => {
      try {
        const res = await grab("https://users.roblox.com/v1/usernames/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ usernames: [u], excludeBannedUsers: false }),
        });
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const json = (await res.json()) as { data?: unknown[] };
        return { verdict: Array.isArray(json.data) && json.data.length > 0 ? "found" : "not_found" };
      } catch {
        return { verdict: "unknown" };
      }
    },
  },
  {
    name: "Steam",
    category: "Games",
    reliability: "medium",
    profile: (u) => `https://steamcommunity.com/id/${u}`,
    check: async (u) => {
      try {
        const res = await grab(`https://steamcommunity.com/id/${encodeURIComponent(u)}/?xml=1`);
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const text = await res.text();
        return { verdict: text.includes("<error>") ? "not_found" : "found" };
      } catch {
        return { verdict: "unknown" };
      }
    },
  },
  {
    name: "Telegram",
    category: "Messaging",
    reliability: "medium",
    profile: (u) => `https://t.me/${u}`,
    check: async (u) => {
      try {
        const res = await grab(`https://t.me/${encodeURIComponent(u)}`);
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const text = await res.text();
        return { verdict: text.includes("tgme_page_title") ? "found" : "not_found" };
      } catch {
        return { verdict: "unknown" };
      }
    },
  },
  {
    name: "SoundCloud",
    category: "Music",
    reliability: "medium",
    profile: (u) => `https://soundcloud.com/${u}`,
    check: (u) => statusOnly(`https://soundcloud.com/${encodeURIComponent(u)}`),
  },
  {
    name: "Last.fm",
    category: "Music",
    reliability: "medium",
    profile: (u) => `https://www.last.fm/user/${u}`,
    check: (u) => statusOnly(`https://www.last.fm/user/${encodeURIComponent(u)}`),
  },
  {
    name: "Vimeo",
    category: "Video",
    reliability: "medium",
    profile: (u) => `https://vimeo.com/${u}`,
    check: (u) => statusOnly(`https://vimeo.com/${encodeURIComponent(u)}`),
  },
  {
    name: "YouTube",
    category: "Video",
    reliability: "medium",
    profile: (u) => `https://www.youtube.com/@${u}`,
    check: (u) => statusOnly(`https://www.youtube.com/@${encodeURIComponent(u)}`),
  },
  {
    name: "Pastebin",
    category: "Leaks",
    reliability: "high",
    profile: (u) => `https://pastebin.com/u/${u}`,
    check: (u) => statusOnly(`https://pastebin.com/u/${encodeURIComponent(u)}`),
  },
  {
    name: "Gravatar",
    category: "Identity",
    reliability: "high",
    profile: (u) => `https://gravatar.com/${u}`,
    check: (u) => statusOnly(`https://gravatar.com/${encodeURIComponent(u)}.json`),
  },
  {
    name: "Dev.to",
    category: "Code",
    reliability: "high",
    profile: (u) => `https://dev.to/${u}`,
    check: (u) => statusOnly(`https://dev.to/api/users/by_username?url=${encodeURIComponent(u)}`),
  },
  {
    name: "Stack Overflow",
    category: "Code",
    reliability: "medium",
    profile: (u) => `https://stackoverflow.com/users?tab=reputation&search=${u}`,
    check: async (u) => {
      try {
        const res = await grab(
          `https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(u)}&site=stackoverflow&pagesize=20`,
        );
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const json = (await res.json()) as { items?: { display_name?: string }[] };
        const exact = (json.items || []).some((i) => (i.display_name || "").toLowerCase() === u.toLowerCase());
        return { verdict: exact ? "found" : "not_found" };
      } catch {
        return { verdict: "unknown" };
      }
    },
  },
  {
    name: "Codeforces",
    category: "Code",
    reliability: "high",
    profile: (u) => `https://codeforces.com/profile/${u}`,
    check: async (u) => {
      try {
        const res = await grab(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(u)}`);
        if (res.status !== 200) return { verdict: fromStatus(res.status) };
        const json = (await res.json()) as { status?: string };
        return { verdict: json.status === "OK" ? "found" : "not_found" };
      } catch {
        return { verdict: "unknown" };
      }
    },
  },
  {
    name: "Replit",
    category: "Code",
    reliability: "low",
    profile: (u) => `https://replit.com/@${u}`,
    check: (u) => statusOnly(`https://replit.com/@${encodeURIComponent(u)}`),
  },
  {
    name: "Linktree",
    category: "Social",
    reliability: "medium",
    profile: (u) => `https://linktr.ee/${u}`,
    check: (u) => statusOnly(`https://linktr.ee/${encodeURIComponent(u)}`),
  },
  {
    name: "Behance",
    category: "Design",
    reliability: "medium",
    profile: (u) => `https://www.behance.net/${u}`,
    check: (u) => statusOnly(`https://www.behance.net/${encodeURIComponent(u)}`),
  },
  {
    name: "Dribbble",
    category: "Design",
    reliability: "medium",
    profile: (u) => `https://dribbble.com/${u}`,
    check: (u) => statusOnly(`https://dribbble.com/${encodeURIComponent(u)}`),
  },
  {
    name: "Flickr",
    category: "Photos",
    reliability: "low",
    profile: (u) => `https://www.flickr.com/people/${u}`,
    check: (u) => statusOnly(`https://www.flickr.com/people/${encodeURIComponent(u)}`),
  },
];

async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function GET(req: NextRequest) {
  const u = (req.nextUrl.searchParams.get("q") || "").trim().replace(/^@/, "");
  if (!u) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });
  if (!/^[a-zA-Z0-9._-]{2,39}$/.test(u)) {
    return NextResponse.json({ error: "Not a valid username" }, { status: 400, headers: JSON_HEADERS });
  }

  const results = await runPool(SITES, 6, async (site): Promise<SiteResult> => {
    const profile = site.profile(u);
    try {
      const { verdict, note } = await site.check(u);
      return { name: site.name, category: site.category, url: profile, verdict, reliability: site.reliability, note };
    } catch {
      return { name: site.name, category: site.category, url: profile, verdict: "unknown", reliability: site.reliability, note: "unreachable" };
    }
  });

  const found = results.filter((r) => r.verdict === "found");
  const blocked = results.filter((r) => r.verdict === "blocked");

  return NextResponse.json(
    {
      target: u,
      checked: results.length,
      foundCount: found.length,
      blockedCount: blocked.length,
      sites: results.sort((a, b) => {
        const rank = { found: 0, unknown: 1, blocked: 2, not_found: 3 };
        return rank[a.verdict] - rank[b.verdict] || a.name.localeCompare(b.name);
      }),
    },
    { headers: JSON_HEADERS },
  );
}
