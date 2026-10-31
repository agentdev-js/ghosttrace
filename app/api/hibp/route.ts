import { NextRequest, NextResponse } from "next/server";
import { JSON_HEADERS, timedFetch, UA } from "@/lib/server";

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

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Not a valid email" }, { status: 400, headers: JSON_HEADERS });
  }

  const key = req.headers.get("x-hibp-key") || process.env.HIBP_API_KEY || "";
  if (!key) {
    return NextResponse.json(
      { error: "HIBP needs an API key", needsKey: "hibp", hint: "The key is purchased at haveibeenpwned.com/API/Key." },
      { status: 401, headers: JSON_HEADERS },
    );
  }

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
      return NextResponse.json({ target: email, pwned: false, count: 0, breaches: [] }, { headers: JSON_HEADERS });
    }
    if (res.status === 401) {
      return NextResponse.json({ error: "HIBP rejected the key", needsKey: "hibp", target: email }, { status: 401, headers: JSON_HEADERS });
    }
    if (res.status === 429) {
      return NextResponse.json({ error: "HIBP rate limit hit. Retry in a few seconds.", target: email }, { status: 429, headers: JSON_HEADERS });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `HIBP returned ${res.status}`, target: email }, { status: 502, headers: JSON_HEADERS });
    }

    const breaches = (await res.json()) as Breach[];
    const totalRecords = breaches.reduce((n, b) => n + (b.PwnCount || 0), 0);

    return NextResponse.json(
      {
        target: email,
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
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, target: email }, { status: 502, headers: JSON_HEADERS });
  }
}
