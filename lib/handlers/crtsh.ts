import { NextRequest, NextResponse } from "next/server";
import { errMessage, JSON_HEADERS, timedFetch } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

interface CrtRow {
  issuer_name?: string;
  common_name?: string;
  name_value?: string;
  not_before?: string;
  not_after?: string;
}

async function pull(domain: string) {
  const url = `https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`;
  const res = await timedFetch(url, { headers: { accept: "application/json" } }, 20000);
  if (!res.ok) throw new Error(`crt.sh returned ${res.status}`);
  const text = await res.text();
  if (!text.trim().startsWith("[")) throw new Error("crt.sh returned an unexpected payload");
  return JSON.parse(text) as CrtRow[];
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase().replace(/^\*\./, "");
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  try {
    let rows: CrtRow[];
    try {
      rows = await pull(q);
    } catch {
      const res = await timedFetch(
        `https://crt.sh/?q=${encodeURIComponent("%." + q)}&exclude=expired&output=json`,
        { headers: { accept: "application/json" } },
        22000,
      );
      if (!res.ok) throw new Error(`crt.sh returned ${res.status}`);
      rows = (await res.json()) as CrtRow[];
    }

    const names = new Set<string>();
    const issuers = new Map<string, number>();
    let first: string | null = null;
    let last: string | null = null;

    for (const row of rows) {
      for (const raw of (row.name_value || "").split("\n")) {
        const name = raw.trim().toLowerCase().replace(/^\*\./, "");
        if (!name || name.includes(" ") || name.includes("@")) continue;
        if (name !== q && !name.endsWith(`.${q}`)) continue;
        names.add(name);
      }
      const issuer = row.issuer_name?.match(/O=([^,]+)/)?.[1] || row.issuer_name?.slice(0, 60);
      if (issuer) issuers.set(issuer, (issuers.get(issuer) || 0) + 1);
      if (row.not_before && (!first || row.not_before < first)) first = row.not_before;
      if (row.not_after && (!last || row.not_after > last)) last = row.not_after;
    }

    const subdomains = [...names].sort((a, b) => a.length - b.length || a.localeCompare(b));

    return NextResponse.json(
      {
        target: q,
        certificates: rows.length,
        subdomains: subdomains.slice(0, 600),
        totalSubdomains: subdomains.length,
        truncated: subdomains.length > 600,
        issuers: [...issuers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
        firstIssued: first,
        lastExpiry: last,
        source: `https://crt.sh/?q=%25.${q}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: errMessage(e),
        target: q,
        hint: "crt.sh rate-limits aggressively. Retry in a few seconds.",
        source: `https://crt.sh/?q=%25.${q}`,
      },
      { status: 502, headers: JSON_HEADERS },
    );
  }
}
