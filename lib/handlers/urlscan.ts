import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

interface ScanResult {
  task?: { url?: string; time?: string; uuid?: string };
  page?: {
    url?: string;
    domain?: string;
    ip?: string;
    asn?: string;
    asnname?: string;
    country?: string;
    server?: string;
    title?: string;
  };
  stats?: { malicious?: number; unresponsive?: number };
  result?: string;
  screenshot?: string;
}

interface ScanResponse {
  total?: number;
  results?: ScanResult[];
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw) || (raw.includes(":") && /^[0-9a-f:]+$/i.test(raw));
  const isUrl = /^https?:\/\//i.test(raw);
  let domain = raw.replace(/^https?:\/\//, "").split("/")[0];
  if (isUrl) {
    try {
      domain = new URL(raw).hostname;
    } catch {
      domain = raw.replace(/^https?:\/\//, "").split("/")[0];
    }
  }

  let query = `page.domain:${domain}`;
  if (isIp) query = `page.ip:${raw}`;
  else if (isUrl) query = `page.url:"${raw}"`;

  const url = `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(query)}&size=50`;

  try {
    const data = await getJson<ScanResponse>(url, {}, 16000);
    const results = (data.results || []).filter((r) => r.page?.url);
    const ips = new Map<string, number>();
    const asns = new Map<string, number>();
    const countries = new Map<string, number>();
    const servers = new Map<string, number>();

    for (const r of results) {
      if (r.page?.ip) ips.set(r.page.ip, (ips.get(r.page.ip) || 0) + 1);
      if (r.page?.asnname) asns.set(r.page.asnname, (asns.get(r.page.asnname) || 0) + 1);
      if (r.page?.country) countries.set(r.page.country, (countries.get(r.page.country) || 0) + 1);
      if (r.page?.server) servers.set(r.page.server, (servers.get(r.page.server) || 0) + 1);
    }

    const top = (m: Map<string, number>, n = 10) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

    return NextResponse.json(
      {
        target: raw,
        query,
        total: data.total ?? results.length,
        recent: results.slice(0, 15).map((r) => ({
          url: r.page?.url,
          title: r.page?.title,
          ip: r.page?.ip,
          asn: r.page?.asn,
          asnName: r.page?.asnname,
          country: r.page?.country,
          server: r.page?.server,
          scannedAt: r.task?.time,
          malicious: r.stats?.malicious ?? 0,
          report: r.result,
          screenshot: r.screenshot,
        })),
        ips: top(ips),
        asns: top(asns),
        countries: top(countries),
        servers: top(servers),
        source: `https://urlscan.io/search/#${encodeURIComponent(query)}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: raw }, { status: 502, headers: JSON_HEADERS });
  }
}
