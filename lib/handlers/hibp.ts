import { NextRequest, NextResponse } from "next/server";
import { getJson, JSON_HEADERS, timedFetch, UA } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

interface Breach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
  LogoPath: string;
}

interface Xposed {
  email?: string | null;
  breach_count?: number;
  breaches?: unknown;
  status?: string;
  Error?: string;
}

const cache = new Map<string, { at: number; names: string[] }>();

function flattenBreaches(value: unknown) {
  const names = new Set<string>();
  const walk = (item: unknown) => {
    if (typeof item === "string") {
      names.add(item);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const name = row.name || row.Name || row.breach || row.title || row.Title;
      if (typeof name === "string") names.add(name);
    }
  };
  walk(value);
  return [...names];
}

async function xposed(email: string) {
  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.names;
  const data = await getJson<Xposed>(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, {}, 10000);
  const names = flattenBreaches(data.breaches);
  cache.set(email, { at: Date.now(), names });
  return names;
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Not a valid email" }, { status: 400, headers: JSON_HEADERS });
  }

  const key = req.headers.get("x-hibp-key") || process.env.HIBP_API_KEY || "";

  if (key) {
    const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
    try {
      const res = await timedFetch(url, {
        headers: {
          "hibp-api-key": key,
          "user-agent": `GhostTrace/${UA.slice(0, 40)}`,
          accept: "application/json",
        },
      }, 14000);

      if (res.status === 404) {
        return NextResponse.json({ target: email, provider: "Have I Been Pwned", pwned: false, count: 0, breaches: [] }, { headers: JSON_HEADERS });
      }
      if (res.ok) {
        const breaches = (await res.json()) as Breach[];
        const totalRecords = breaches.reduce((n, b) => n + (b.PwnCount || 0), 0);
        return NextResponse.json(
          {
            target: email,
            provider: "Have I Been Pwned",
            pwned: breaches.length > 0,
            count: breaches.length,
            breaches: breaches
              .sort((a, b) => (b.BreachDate || "").localeCompare(a.BreachDate || ""))
              .map((b) => ({
                name: b.Name,
                title: b.Title,
                domain: b.Domain,
                date: b.BreachDate,
                added: b.AddedDate,
                accounts: b.PwnCount,
                dataClasses: b.DataClasses,
                verified: b.IsVerified,
                sensitive: b.IsSensitive,
                spamList: b.IsSpamList,
                description: b.Description?.replace(/<[^>]+>/g, "").slice(0, 400),
              })),
            totalRecords,
            source: `https://haveibeenpwned.com/account/${encodeURIComponent(email)}`,
          },
          { headers: JSON_HEADERS },
        );
      }
    } catch {}
  }

  try {
    const names = await xposed(email);
    return NextResponse.json(
      {
        target: email,
        provider: "XposedOrNot",
        pwned: names.length > 0,
        count: names.length,
        breaches: names.slice(0, 150).map((name) => ({ name, title: name })),
        totalRecords: null,
        note: names.length
          ? "Keyless breach index match. Add an HIBP key for verified dates and exposed data classes."
          : "No public breach index match for this address.",
        source: `https://xposedornot.com/`,
      },
      { headers: JSON_HEADERS },
    );
  } catch {
    try {
      const data = await getJson<{ success?: boolean; error?: string; sources?: string[] }>(
        `https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`,
        {},
        12000,
      );
      const found = Boolean(data.success);
      return NextResponse.json(
        {
          target: email,
          provider: "LeakCheck",
          pwned: found,
          count: found ? 1 : 0,
          breaches: found ? [{ name: "Public leak index", title: "Public leak index" }] : [],
          sources: data.sources || [],
          note: "Keyless fallback index. Add an HIBP key for full breach metadata.",
          source: "https://leakcheck.io/",
        },
        { headers: JSON_HEADERS },
      );
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message, target: email, hint: "Breach indexes are throttled right now. Retry in a minute." },
        { status: 502, headers: JSON_HEADERS },
      );
    }
  }
}
