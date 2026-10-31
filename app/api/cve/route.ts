import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

interface CveItem {
  cve: {
    id: string;
    published: string;
    lastModified: string;
    vulnStatus: string;
    descriptions: { lang: string; value: string }[];
    metrics?: Record<string, { cvssData?: { baseScore?: number; baseSeverity?: string; vectorString?: string }; baseScore?: number; baseSeverity?: string }[]>;
    weaknesses?: { description: { lang: string; value: string }[] }[];
    configurations?: unknown[];
    references?: { url: string; source?: string; tags?: string[] }[];
  };
}

interface NvdResponse {
  totalResults: number;
  vulnerabilities: CveItem[];
}

function metricOf(cve: CveItem["cve"]) {
  const metrics = cve.metrics || {};
  for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const arr = metrics[key];
    if (Array.isArray(arr) && arr.length) {
      const m = arr[0];
      return {
        version: key.replace("cvssMetricV", "").split("")[0],
        score: m.cvssData?.baseScore ?? m.baseScore ?? null,
        severity: m.cvssData?.baseSeverity ?? m.baseSeverity ?? null,
        vector: m.cvssData?.vectorString ?? null,
      };
    }
  }
  return null;
}

function normalize(item: CveItem) {
  const c = item.cve;
  const description = c.descriptions.find((d) => d.lang === "en")?.value || c.descriptions[0]?.value || "";
  const weaknesses = (c.weaknesses || [])
    .flatMap((w) => w.description.filter((d) => d.lang === "en" || d.lang === "es").map((d) => d.value))
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return {
    id: c.id,
    published: c.published,
    modified: c.lastModified,
    status: c.vulnStatus,
    description,
    cvss: metricOf(c),
    weaknesses,
    references: (c.references || []).slice(0, 12).map((r) => ({ url: r.url, tags: r.tags })),
    nvd: `https://nvd.nist.gov/vuln/detail/${c.id}`,
  };
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const isCve = /^CVE-\d{4}-\d{4,}$/i.test(raw);
  const url = isCve
    ? `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(raw.toUpperCase())}`
    : `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(raw)}&resultsPerPage=10`;

  try {
    const data = await getJson<NvdResponse>(url, { headers: { accept: "application/json" } }, 30000);
    const items = (data.vulnerabilities || []).map(normalize);
    return NextResponse.json(
      {
        target: raw,
        mode: isCve ? "cve" : "keyword",
        total: data.totalResults ?? items.length,
        items,
        source: isCve
          ? `https://nvd.nist.gov/vuln/detail/${raw.toUpperCase()}`
          : `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(raw)}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: raw }, { status: 502, headers: JSON_HEADERS });
  }
}
