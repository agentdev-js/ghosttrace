import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface VtAttributes {
  last_analysis_stats?: Record<string, number>;
  last_analysis_results?: Record<string, { category?: string; result?: string; engine_name?: string }>;
  reputation?: number;
  tags?: string[];
  categories?: Record<string, string>;
  total_votes?: { harmless?: number; malicious?: number };
  registrar?: string;
  creation_date?: number;
  last_modification_date?: number;
  last_analysis_date?: number;
  whois?: string;
  as_owner?: string;
  asn?: number;
  country?: string;
  network?: string;
  regional_internet_registry?: string;
  continent?: string;
  meaningful_name?: string;
  names?: string[];
  type_description?: string;
  size?: number;
  sha256?: string;
  sha1?: string;
  md5?: string;
  first_submission_date?: number;
  last_submission_date?: number;
  times_submitted?: number;
  url?: string;
  title?: string;
  last_http_response_content_length?: number;
}

interface VtResponse {
  data?: { id?: string; type?: string; attributes?: VtAttributes };
}

interface OtxPulse {
  name?: string;
  description?: string;
  created?: string;
  modified?: string;
  tags?: string[];
  adversary?: string;
  malware_families?: { display_name?: string }[];
  targeted_countries?: string[];
}

interface OtxGeneral {
  pulse_info?: { count?: number; pulses?: OtxPulse[] };
  validation?: { source?: string; name?: string; message?: string }[];
  reputation?: number;
  false_positive?: boolean | null;
  whois?: string;
}

interface ScanSearch {
  total?: number;
  results?: {
    page?: { url?: string; domain?: string; ip?: string };
    task?: { url?: string; time?: string };
    stats?: { uniqIPs?: number; uniqCountries?: number };
  }[];
}

const otxCache = new Map<string, { at: number; value: OtxGeneral }>();

function ts(v?: number) {
  return v ? new Date(v * 1000).toISOString() : null;
}

async function otxLookup(path: string, indicator: string) {
  const key = `${path}:${indicator}`;
  const hit = otxCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value;
  const data = await getJson<OtxGeneral>(
    `https://otx.alienvault.com/api/v1/indicators/${path}/${encodeURIComponent(indicator)}/general`,
    {},
    18000,
  );
  otxCache.set(key, { at: Date.now(), value: data });
  return data;
}

async function scanFallback(target: string, kind: string, host: string) {
  const query = kind === "ip_addresses" ? `page.ip:${target}` : `page.domain:${host}`;
  const data = await getJson<ScanSearch>(
    `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(query)}&size=10`,
    {},
    14000,
  );
  return {
    target,
    kind,
    provider: "URLScan.io",
    totalScans: data.total ?? 0,
    recent: (data.results || []).slice(0, 10).map((r) => ({
      page: r.page?.url,
      domain: r.page?.domain,
      ip: r.page?.ip,
      task: r.task?.url,
      time: r.task?.time,
      uniqueIps: r.stats?.uniqIPs,
      countries: r.stats?.uniqCountries,
    })),
    note: "Threat-intel feeds were busy. Showing recent public scan activity instead.",
    source: `https://urlscan.io/search/#${encodeURIComponent(query)}`,
  };
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const key = req.headers.get("x-vt-key") || process.env.VT_API_KEY || "";

  let kind = "";
  let id = "";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(raw) || (raw.includes(":") && /^[0-9a-f:]+$/i.test(raw))) {
    kind = "ip_addresses";
    id = raw;
  } else if (/^https?:\/\//i.test(raw)) {
    kind = "urls";
    id = Buffer.from(raw).toString("base64url");
  } else if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(raw)) {
    kind = "files";
    id = raw;
  } else {
    kind = "domains";
    id = raw.replace(/^https?:\/\//, "").split("/")[0];
  }

  const host = kind === "urls" ? raw.replace(/^https?:\/\//, "").split("/")[0] : id;
  let vtError: string | null = null;

  if (key) {
    try {
      const data = await getJson<VtResponse>(`https://www.virustotal.com/api/v3/${kind}/${encodeURIComponent(id)}`, {
        headers: { "x-apikey": key },
      }, 16000);
      const a = data.data?.attributes || {};
      const stats = a.last_analysis_stats || {};
      const detections = (stats.malicious || 0) + (stats.suspicious || 0);

      return NextResponse.json(
        {
          target: raw,
          kind,
          id,
          provider: "VirusTotal",
          detections,
          stats,
          reputation: a.reputation ?? null,
          votes: a.total_votes ?? null,
          tags: a.tags || [],
          categories: a.categories || {},
          names: a.names || [],
          type: a.type_description || null,
          size: a.size ?? null,
          hashes: kind === "files" ? { sha256: a.sha256, sha1: a.sha1, md5: a.md5 } : null,
          submission: {
            first: ts(a.first_submission_date),
            last: ts(a.last_submission_date),
            count: a.times_submitted ?? null,
          },
          network: kind === "ip_addresses" || kind === "domains"
            ? {
                asOwner: a.as_owner,
                asn: a.asn,
                country: a.country,
                network: a.network,
                registry: a.regional_internet_registry,
                registrar: a.registrar,
                created: ts(a.creation_date),
                updated: ts(a.last_modification_date),
                analysed: ts(a.last_analysis_date),
              }
            : null,
          engines: Object.entries(a.last_analysis_results || {})
            .filter(([, v]) => v.category === "malicious" || v.category === "suspicious")
            .slice(0, 20)
            .map(([engine, v]) => ({ engine, verdict: v.result, category: v.category })),
          source: `https://www.virustotal.com/gui/search/${encodeURIComponent(raw)}`,
        },
        { headers: JSON_HEADERS },
      );
    } catch (e) {
      vtError = errMessage(e);
    }
  }

  const path = kind === "ip_addresses" ? "IPv4" : kind === "files" ? "file" : "domain";

  try {
    const data = await otxLookup(path, host);
    const pulses = data.pulse_info?.pulses || [];
    const seen = new Set<string>();
    const signals = pulses
      .filter((p) => {
        const name = (p.name || "").trim();
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .slice(0, 12)
      .map((p) => ({
        name: p.name,
        adversary: p.adversary || null,
        tags: (p.tags || []).slice(0, 8),
        families: (p.malware_families || []).map((f) => f.display_name).filter(Boolean).slice(0, 5),
        countries: (p.targeted_countries || []).slice(0, 8),
        created: p.created,
        modified: p.modified,
      }));

    return NextResponse.json(
      {
        target: raw,
        kind,
        provider: "AlienVault OTX",
        host,
        pulseCount: data.pulse_info?.count ?? signals.length,
        signals,
        validation: (data.validation || [])
          .slice(0, 8)
          .map((v) => [v.source, v.message || v.name].filter(Boolean).join(": "))
          .filter(Boolean),
        reputation: data.reputation ?? null,
        falsePositive: data.false_positive ?? null,
        whois: data.whois || null,
        degraded: Boolean(vtError),
        vtError,
        note: vtError
          ? `VirusTotal key failed (${vtError}). Showing keyless OTX intelligence instead.`
          : "Keyless OTX intelligence. Add a VirusTotal key for engine-level detections.",
        source: `https://otx.alienvault.com/indicator/${path}/${encodeURIComponent(host)}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    try {
      const fallback = await scanFallback(raw, kind, host);
      return NextResponse.json(fallback, { headers: JSON_HEADERS });
    } catch {
      return NextResponse.json(
        {
          error: errMessage(e),
          target: raw,
          hint: "OTX and URLScan are both throttled right now. Retry in a minute or add a VirusTotal key.",
        },
        { status: 502, headers: JSON_HEADERS },
      );
    }
  }
}
