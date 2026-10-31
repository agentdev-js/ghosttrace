import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

interface Availability {
  archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string; status?: string } };
}

type CdxRow = [string, string, string, string];

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const target = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const [availability, cdx] = await Promise.allSettled([
    getJson<Availability>(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}`, {}, 14000),
    getJson<CdxRow[]>(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}/*&output=json&fl=timestamp,original,statuscode,mimetype&collapse=urlkey&limit=400&filter=statuscode:200`,
      {},
      12000,
    ),
  ]);

  const closest = availability.status === "fulfilled" ? availability.value.archived_snapshots?.closest : undefined;

  let rows: CdxRow[] = [];
  let cdxError: string | null = null;
  if (cdx.status === "fulfilled") {
    rows = cdx.value.slice(1);
  } else {
    cdxError = errMessage(cdx.reason);
  }

  const uniqueHosts = new Set<string>();
  const uniquePaths = new Set<string>();
  const byYear = new Map<string, number>();
  const byMime = new Map<string, number>();
  const samples: { url: string; timestamp: string; status: string; mime: string }[] = [];

  for (const row of rows) {
    const [timestamp, original, status, mime] = row;
    if (!original) continue;
    try {
      const u = new URL(original);
      uniqueHosts.add(u.hostname);
      uniquePaths.add(u.pathname);
      const year = timestamp.slice(0, 4);
      byYear.set(year, (byYear.get(year) || 0) + 1);
      if (mime) byMime.set(mime, (byMime.get(mime) || 0) + 1);
    } catch {
      continue;
    }
    if (samples.length < 60) samples.push({ url: original, timestamp, status, mime });
  }

  const years = [...byYear.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));

  return NextResponse.json(
    {
      target,
      available: Boolean(closest?.available),
      closest: closest
        ? {
            url: closest.url,
            timestamp: closest.timestamp,
            status: closest.status,
          }
        : null,
      snapshots: rows.length,
      uniqueUrls: rows.length,
      hosts: uniqueHosts.size,
      paths: uniquePaths.size,
      firstSnapshot: rows.length ? rows[0][0] : null,
      lastSnapshot: rows.length ? rows[rows.length - 1][0] : null,
      coverage: years.map(([year, count]) => ({ year, count })),
      mimeTypes: [...byMime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([mime, count]) => ({ mime, count })),
      samples,
      cdxError,
      source: `https://web.archive.org/web/*/${target}`,
    },
    { headers: JSON_HEADERS },
  );
}
