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

function ts(v?: number) {
  return v ? new Date(v * 1000).toISOString() : null;
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const key = req.headers.get("x-vt-key") || process.env.VT_API_KEY || "";
  if (!key) {
    return NextResponse.json(
      { error: "VirusTotal needs an API key", needsKey: "virustotal", hint: "A free VT account key works. Add it in Settings." },
      { status: 401, headers: JSON_HEADERS },
    );
  }

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
    const msg = errMessage(e);
    let body: Record<string, unknown> = { error: msg, target: raw };
    if (msg.startsWith("401") || msg.startsWith("403")) {
      body = { error: "VirusTotal rejected the key", needsKey: "virustotal", target: raw };
      return NextResponse.json(body, { status: 401, headers: JSON_HEADERS });
    }
    if (msg.startsWith("429")) body.error = "VirusTotal rate limit hit. Wait a minute.";
    return NextResponse.json(body, { status: 502, headers: JSON_HEADERS });
  }
}
