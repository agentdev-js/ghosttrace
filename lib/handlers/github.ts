import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface GhUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  hireable: boolean | null;
}

interface GhRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  topics?: string[];
  pushed_at: string;
}

interface GhOrg {
  login: string;
  url: string;
  avatar_url: string;
}

interface GhSocial {
  provider: string;
  url: string;
}

interface GhSearch {
  total_count: number;
  items: {
    login: string;
    avatar_url: string;
    html_url: string;
    score: number;
    type: string;
  }[];
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim().replace(/^@/, "");
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const token = req.headers.get("x-github-token") || process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  if (/\s/.test(raw)) {
    try {
      const search = await getJson<GhSearch>(
        `https://api.github.com/search/users?q=${encodeURIComponent(raw)}&per_page=20`,
        { headers },
        14000,
      );
      const profiles = (search.items || []).map((u) => ({
        login: u.login,
        url: u.html_url,
        avatar: u.avatar_url,
        type: u.type,
        score: u.score,
      }));
      return NextResponse.json(
        {
          target: raw,
          mode: "search",
          found: profiles.length > 0,
          total: search.total_count ?? profiles.length,
          profiles,
          authenticated: Boolean(token),
          source: `https://github.com/search?q=${encodeURIComponent(raw)}&type=users`,
        },
        { headers: JSON_HEADERS },
      );
    } catch (e) {
      return NextResponse.json({ error: errMessage(e), target: raw }, { status: 502, headers: JSON_HEADERS });
    }
  }

  try {
    const user = await getJson<GhUser>(`https://api.github.com/users/${encodeURIComponent(raw)}`, { headers }, 10000);

    const [reposRes, orgsRes, socialRes] = await Promise.allSettled([
      getJson<GhRepo[]>(
        `https://api.github.com/users/${encodeURIComponent(raw)}/repos?per_page=100&sort=updated&type=owner`,
        { headers },
        12000,
      ),
      getJson<GhOrg[]>(`https://api.github.com/users/${encodeURIComponent(raw)}/orgs`, { headers }, 10000),
      getJson<GhSocial[]>(`https://api.github.com/users/${encodeURIComponent(raw)}/social_accounts`, { headers }, 10000),
    ]);

    const repos = reposRes.status === "fulfilled" ? reposRes.value : [];
    const orgs = orgsRes.status === "fulfilled" ? orgsRes.value : [];
    const socials = socialRes.status === "fulfilled" ? socialRes.value : [];

    const languages = new Map<string, number>();
    for (const r of repos) if (r.language) languages.set(r.language, (languages.get(r.language) || 0) + 1);

    const topRepos = repos
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 8)
      .map((r) => ({
        name: r.name,
        url: r.html_url,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        archived: r.archived,
        pushed: r.pushed_at,
      }));

    return NextResponse.json(
      {
        target: raw,
        found: true,
        profile: {
          login: user.login,
          id: user.id,
          name: user.name,
          bio: user.bio,
          company: user.company,
          blog: user.blog,
          location: user.location,
          email: user.email,
          twitter: user.twitter_username,
          avatar: user.avatar_url,
          url: user.html_url,
          hireable: user.hireable,
        },
        stats: {
          publicRepos: user.public_repos,
          publicGists: user.public_gists,
          followers: user.followers,
          following: user.following,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        languages: [...languages.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        topRepos,
        orgs: orgs.map((o) => ({ login: o.login, url: o.url })),
        socials,
        authenticated: Boolean(token),
        source: user.html_url,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    const msg = errMessage(e);
    if (msg.startsWith("404")) {
      return NextResponse.json({ target: raw, found: false, source: `https://github.com/${raw}` }, { headers: JSON_HEADERS });
    }
    return NextResponse.json({ error: msg, target: raw }, { status: 502, headers: JSON_HEADERS });
  }
}
