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

interface DnsJson {
  Status: number;
  Answer?: Answer[];
}

const PROVIDERS = [
  {
    name: "Cloudflare DoH",
    url: (name: string, type: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  },
  {
    name: "Google DNS",
    url: (name: string, type: string) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  },
];

async function attempt(name: string, type: string, provider: (typeof PROVIDERS)[number]) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);
  try {
    const res = await fetch(provider.url(name, type), {
      headers: { accept: "application/dns-json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as DnsJson;
    return {
      type,
      status: json.Status,
      resolver: provider.name,
      answers: (json.Answer || []).map((a) => ({
        name: a.name,
        type: a.type,
        ttl: a.TTL,
        data: a.data,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function query(name: string, type: string) {
  let lastError = "no response";
  for (const provider of PROVIDERS) {
    try {
      return await attempt(name, type, provider);
    } catch (e) {
      lastError = (e as Error).name === "AbortError" ? "timeout" : (e as Error).message;
    }
  }
  return { type, error: lastError, resolver: null, answers: [] as Answer[] };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const results = await Promise.all(TYPES.map((t) => query(q, t)));
  const records = results.filter((r) => r.answers.length > 0);
  const total = records.reduce((n, r) => n + r.answers.length, 0);
  const resolvers = [...new Set(results.map((r) => r.resolver).filter(Boolean))];

  return NextResponse.json(
    {
      target: q,
      resolver: resolvers.length > 0 ? resolvers.join(" + ") : "Cloudflare DoH + Google DNS",
      total,
      records,
      errors: results.filter((r) => "error" in r && r.error).map((r) => ({ type: r.type, error: (r as { error: string }).error })),
    },
    { headers: JSON_HEADERS },
  );
}
