import { lookup } from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS, timedFetch } from "@/lib/server";

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

interface DnsJson {
  Answer?: { data: string }[];
}

function isPrivate(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return true;
  return (
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
  );
}

async function publicHost(domain: string) {
  try {
    const rows = await lookup(domain, { all: true });
    return rows.length > 0 && rows.every((r) => !isPrivate(r.address));
  } catch {
    return false;
  }
}

async function fetchText(url: string) {
  const res = await timedFetch(url, { headers: { accept: "text/html, text/plain, */*" } }, 8000);
  if (!res.ok) throw new Error(`${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > 2_000_000) return "";
  const text = await res.text();
  return text.slice(0, 1_500_000);
}

function extractEmails(text: string, domain: string) {
  const found = new Set<string>();
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  for (const raw of matches) {
    const email = raw.toLowerCase().replace(/[.,;:]+$/, "");
    const host = email.split("@")[1];
    if (host === domain || host.endsWith(`.${domain}`)) found.add(email);
  }
  return [...found];
}

function providerOf(mx: string[]) {
  const joined = mx.join(" ").toLowerCase();
  if (joined.includes("google")) return "Google Workspace";
  if (joined.includes("outlook") || joined.includes("microsoft")) return "Microsoft 365";
  if (joined.includes("zoho")) return "Zoho Mail";
  if (joined.includes("proton")) return "Proton Mail";
  if (joined.includes("mimecast")) return "Mimecast";
  if (joined.includes("pphosted") || joined.includes("proofpoint")) return "Proofpoint";
  if (joined.includes("barracuda")) return "Barracuda";
  if (joined.includes("amazonses") || joined.includes("aws")) return "Amazon SES";
  if (joined.includes("yandex")) return "Yandex Mail";
  if (joined.includes("mail.ru")) return "Mail.ru";
  return null;
}

async function patterns(domain: string) {
  const mxData = await getJson<DnsJson>(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
    { headers: { accept: "application/dns-json" } },
    7000,
  ).catch(() => null);

  const mx = (mxData?.Answer || [])
    .map((a) => a.data.split(/\s+/).pop()?.replace(/\.$/, "") || "")
    .filter(Boolean);

  const urls = [`https://${domain}/`, `https://${domain}/.well-known/security.txt`, `https://${domain}/contact`];
  const safe = await publicHost(domain);
  const pages = safe ? await Promise.allSettled(urls.map((u) => fetchText(u))) : [];

  const emails = new Map<string, string>();
  pages.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    for (const email of extractEmails(result.value, domain)) {
      if (!emails.has(email)) emails.set(email, urls[i]);
    }
  });

  return {
    target: domain,
    provider: "Pattern engine",
    mx,
    mailProvider: providerOf(mx),
    pattern: `first.last@${domain}`,
    emails: [...emails.entries()].map(([email, source]) => ({ email, source })),
    total: emails.size,
    publicSources: urls,
    note: emails.size
      ? "Contacts observed on public pages. The pattern is a candidate, not a verified mailbox."
      : "No public contacts found on the homepage or security.txt. The pattern is a candidate, not a verified mailbox.",
    source: `https://hunter.io/search/${domain}`,
  };
}

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!domain) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const key = req.headers.get("x-hunter-key") || process.env.HUNTER_API_KEY || "";

  if (key) {
    try {
      const data = await getJson<HunterResponse>(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=25&api_key=${encodeURIComponent(key)}`,
        {},
        16000,
      );

      if (!data.errors?.length) {
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
            provider: "Hunter.io",
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
      }
    } catch {}
  }

  try {
    return NextResponse.json(await patterns(domain), { headers: JSON_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: domain }, { status: 502, headers: JSON_HEADERS });
  }
}
