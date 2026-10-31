import { NextRequest, NextResponse } from "next/server";
import { JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TYPES = ["A", "AAAA", "MX", "TXT", "NS", "SOA", "CNAME", "CAA"];

interface Answer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

async function query(name: string, type: string) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return { type, error: `HTTP ${res.status}`, answers: [] as Answer[] };
    const json = (await res.json()) as { Status: number; Answer?: Answer[] };
    return {
      type,
      status: json.Status,
      answers: (json.Answer || []).map((a) => ({
        name: a.name,
        type: a.type,
        ttl: a.TTL,
        data: a.data,
      })),
    };
  } catch (e) {
    return { type, error: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message, answers: [] as Answer[] };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const results = await Promise.all(TYPES.map((t) => query(q, t)));
  const records = results.filter((r) => r.answers.length > 0);
  const total = records.reduce((n, r) => n + r.answers.length, 0);

  return NextResponse.json(
    {
      target: q,
      resolver: "Cloudflare DoH",
      total,
      records,
      errors: results.filter((r) => "error" in r && r.error).map((r) => ({ type: r.type, error: (r as { error: string }).error })),
    },
    { headers: JSON_HEADERS },
  );
}
