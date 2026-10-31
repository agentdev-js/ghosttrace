import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

interface Availability {
  archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string; status?: string } };
}

interface Sparkline {
  years?: Record<string, number[]>;
  first_ts?: string;
  last_ts?: string;
}

type CdxRow = [string, string, string, string];

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const target = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const [availability, spark, cdx] = await Promise.allSettled([
    getJson<Availability>(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}`, {}, 12000),
    getJson<Sparkline>(
      `https://web.archive.org/__wb/sparkline?output=json&url=${encodeURIComponent(target)}&collection=web`,
      {},
      12000,
    ),
    getJson<CdxRow[]>(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&fl=timestamp,original,statuscode,mimetype&limit=-120`,
      {},
      12000,
    ),
  ]);

  const closest = availability.status === "fulfilled" ? availability.value.archived_snapshots?.closest : undefined;
  const sparkData = spark.status === "fulfilled" ? spark.value : null;
  const rows: CdxRow[] = cdx.status === "fulfilled" ? cdx.value.slice(1) : [];

  const byYear = new Map<string, number>();
  let total = 0;
  if (sparkData?.years) {
    for (const [year, months] of Object.entries(sparkData.years)) {
      const sum = months.reduce((acc, n) => acc + (Number(n) || 0), 0);
      if (sum > 0) {
        byYear.set(year, sum);
        total += sum;
      }
    }
  }

  const uniqueHosts = new Set<string>();
  const uniquePaths = new Set<string>();
  const byMime = new Map<string, number>();
  const samples: { url: string; timestamp: string; status: string; mime: string }[] = [];

  for (const row of rows) {
    const [timestamp, original, status, mime] = row;
    if (!original) continue;
    try {
      const u = new URL(original);
      uniqueHosts.add(u.hostname);
      uniquePaths.add(u.pathname);
    } catch {
      continue;
    }
    if (!sparkData && timestamp) byYear.set(timestamp.slice(0, 4), (byYear.get(timestamp.slice(0, 4)) || 0) + 1);
    if (mime) byMime.set(mime, (byMime.get(mime) || 0) + 1);
    if (samples.length < 60) samples.push({ url: original, timestamp, status, mime });
  }

  if (!total) total = rows.length;

  const years = [...byYear.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const firstSnapshot = sparkData?.first_ts || (rows.length ? rows[0][0] : null);
  const lastSnapshot = sparkData?.last_ts || (rows.length ? rows[rows.length - 1][0] : null);

  const fail = availability.status === "rejected" && spark.status === "rejected" && cdx.status === "rejected";
  const cdxError = cdx.status === "rejected" ? errMessage(cdx.reason) : null;

  return NextResponse.json(
    {
      target,
      available: Boolean(closest?.available) || total > 0,
      closest: closest
        ? {
            url: closest.url,
            timestamp: closest.timestamp,
            status: closest.status,
          }
        : null,
      snapshots: total,
      uniqueUrls: rows.length,
      hosts: uniqueHosts.size,
      paths: uniquePaths.size,
      firstSnapshot,
      lastSnapshot,
      coverage: years.map(([year, count]) => ({ year, count })),
      mimeTypes: [...byMime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([mime, count]) => ({ mime, count })),
      samples,
      cdxError,
      degraded: fail,
      note: fail
        ? "archive.org throttled the request from this network. Retry in a few seconds."
        : "Snapshot totals come from the Wayback sparkline; samples are the latest captures.",
      source: `https://web.archive.org/web/*/${target}`,
    },
    { headers: JSON_HEADERS },
  );
}
