import { NextRequest, NextResponse } from "next/server";
import { getJson, errMessage, JSON_HEADERS, timedFetch } from "@/lib/server";

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

interface CsRow {
  dns_names?: string[];
  issuer?: { name?: string; friendly_name?: string };
  not_before?: string;
  not_after?: string;
  revoked?: boolean;
}

function collect(rows: { names: string[]; issuer?: string; notBefore?: string; notAfter?: string }[], q: string) {
  const names = new Set<string>();
  const issuers = new Map<string, number>();
  let first: string | null = null;
  let last: string | null = null;

  for (const row of rows) {
    for (const raw of row.names) {
      const name = raw.trim().toLowerCase().replace(/^\*\./, "");
      if (!name || name.includes(" ") || name.includes("@")) continue;
      if (name !== q && !name.endsWith(`.${q}`)) continue;
      names.add(name);
    }
    if (row.issuer) issuers.set(row.issuer, (issuers.get(row.issuer) || 0) + 1);
    if (row.notBefore && (!first || row.notBefore < first)) first = row.notBefore;
    if (row.notAfter && (!last || row.notAfter > last)) last = row.notAfter;
  }

  return { names, issuers, first, last };
}

async function pullCrt(q: string) {
  const url = `https://crt.sh/?q=${encodeURIComponent("%." + q)}&output=json&exclude=expired`;
  const res = await timedFetch(url, { headers: { accept: "application/json" } }, 15000);
  if (!res.ok) throw new Error(`crt.sh returned ${res.status}`);
  const text = await res.text();
  if (!text.trim().startsWith("[")) throw new Error("crt.sh returned an unexpected payload");
  return JSON.parse(text) as CrtRow[];
}

function fromCrt(rows: CrtRow[], q: string) {
  const mapped = rows.map((row) => ({
    names: (row.name_value || row.common_name || "").split("\n"),
    issuer: row.issuer_name?.match(/O=([^,]+)/)?.[1] || row.issuer_name?.slice(0, 60),
    notBefore: row.not_before,
    notAfter: row.not_after,
  }));
  return collect(mapped, q);
}

function fromCertspotter(rows: CsRow[], q: string) {
  const mapped = rows.map((row) => ({
    names: row.dns_names || [],
    issuer: row.issuer?.friendly_name || row.issuer?.name?.match(/O=([^,]+)/)?.[1] || row.issuer?.name,
    notBefore: row.not_before,
    notAfter: row.not_after,
  }));
  return collect(mapped, q);
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase().replace(/^\*\./, "");
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  let count = 0;
  let provider = "crt.sh";
  let data: ReturnType<typeof collect> | null = null;
  let crtError: string | null = null;
  let csError: string | null = null;

  try {
    const rows = await pullCrt(q);
    count = rows.length;
    data = fromCrt(rows, q);
  } catch (e) {
    crtError = errMessage(e);
  }

  if (!data) {
    try {
      const rows = await getJson<CsRow[]>(
        `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(q)}&include_subdomains=true&expand=dns_names&expand=issuer`,
        {},
        18000,
      );
      count = rows.length;
      provider = "Cert Spotter";
      data = fromCertspotter(rows, q);
    } catch (e) {
      csError = errMessage(e);
    }
  }

  if (!data) {
    return NextResponse.json(
      {
        error: `Certificate sources unavailable: ${crtError || "crt.sh failed"}; ${csError || "Cert Spotter failed"}`,
        target: q,
        hint: "Both CT sources timed out. Retry shortly.",
        source: `https://crt.sh/?q=%25.${q}`,
      },
      { status: 502, headers: JSON_HEADERS },
    );
  }

  const subdomains = [...data.names].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const issuers = [...data.issuers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return NextResponse.json(
    {
      target: q,
      provider,
      certificates: count,
      subdomains: subdomains.slice(0, 600),
      totalSubdomains: subdomains.length,
      truncated: subdomains.length > 600,
      issuers: issuers.map(([name, c]) => ({ name, count: c })),
      firstIssued: data.first,
      lastExpiry: data.last,
      degraded: Boolean(crtError),
      crtError,
      source: provider === "crt.sh" ? `https://crt.sh/?q=%25.${q}` : `https://certspotter.com/`,
    },
    { headers: JSON_HEADERS },
  );
}
