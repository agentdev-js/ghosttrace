import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface HunterEmail {
  value?: string;
  type?: string;
  confidence?: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  seniority?: string;
  department?: string;
  linkedin?: string;
  twitter?: string;
  phone_number?: string;
  sources?: { domain?: string; uri?: string; extracted_on?: string }[];
}

interface HunterResponse {
  data?: {
    domain?: string;
    disposable?: boolean;
    webmail?: boolean;
    accept_all?: boolean;
    pattern?: string;
    organization?: string;
    description?: string;
    industry?: string;
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    headcount?: string;
    emails?: HunterEmail[];
    total?: number;
  };
  errors?: { details?: string }[];
}

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!domain) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const key = req.headers.get("x-hunter-key") || process.env.HUNTER_API_KEY || "";
  if (!key) {
    return NextResponse.json(
      { error: "Hunter.io needs an API key", needsKey: "hunter", hint: "The free plan covers 25 searches per month." },
      { status: 401, headers: JSON_HEADERS },
    );
  }

  try {
    const data = await getJson<HunterResponse>(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=25&api_key=${encodeURIComponent(key)}`,
      {},
      16000,
    );

    if (data.errors?.length) {
      return NextResponse.json({ error: data.errors[0].details || "Hunter returned an error", target: domain }, { status: 502, headers: JSON_HEADERS });
    }

    const d = data.data || {};
    const emails = (d.emails || []).map((e) => ({
      email: e.value,
      type: e.type,
      confidence: e.confidence,
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || null,
      position: e.position,
      seniority: e.seniority,
      department: e.department,
      linkedin: e.linkedin,
      twitter: e.twitter,
      phone: e.phone_number,
      sources: (e.sources || []).slice(0, 3).map((s) => s.uri),
    }));

    return NextResponse.json(
      {
        target: domain,
        organisation: {
          name: d.organization,
          description: d.description,
          industry: d.industry,
          headcount: d.headcount,
          twitter: d.twitter,
          linkedin: d.linkedin,
          facebook: d.facebook,
          instagram: d.instagram,
        },
        pattern: d.pattern || null,
        disposable: d.disposable ?? null,
        webmail: d.webmail ?? null,
        acceptAll: d.accept_all ?? null,
        total: d.total ?? emails.length,
        emails,
        source: `https://hunter.io/search/${domain}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    const msg = errMessage(e);
    if (msg.startsWith("401") || msg.startsWith("403")) {
      return NextResponse.json({ error: "Hunter rejected the key", needsKey: "hunter", target: domain }, { status: 401, headers: JSON_HEADERS });
    }
    return NextResponse.json({ error: msg, target: domain }, { status: 502, headers: JSON_HEADERS });
  }
}
