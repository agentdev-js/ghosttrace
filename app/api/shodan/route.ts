import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface ShodanHost {
  ip_str?: string;
  org?: string;
  isp?: string;
  asn?: string;
  os?: string;
  country_name?: string;
  city?: string;
  region_code?: string;
  hostnames?: string[];
  domains?: string[];
  ports?: number[];
  tags?: string[];
  last_update?: string;
  vulns?: string[];
  data?: {
    port?: number;
    transport?: string;
    product?: string;
    version?: string;
    module?: string;
    data?: string;
    ssl?: { cert?: { subject?: Record<string, string>; issuer?: Record<string, string> } };
  }[];
}

interface ShodanDns {
  domain?: string;
  tags?: string[];
  data?: { subdomain?: string; type?: string; value?: string; last_seen?: string }[];
}

async function resolve(domain: string) {
  const res = await getJson<{ Answer?: { data: string }[] }>(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
    { headers: { accept: "application/dns-json" } },
    7000,
  );
  return res.Answer?.[0]?.data || null;
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const key = req.headers.get("x-shodan-key") || process.env.SHODAN_API_KEY || "";
  if (!key) {
    return NextResponse.json(
      { error: "Shodan needs an API key", needsKey: "shodan", hint: "Add it in Settings. The free tier is enough for host lookups." },
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw) || (raw.includes(":") && /^[0-9a-f:]+$/i.test(raw));

  try {
    if (isIp) {
      const data = await getJson<ShodanHost>(`https://api.shodan.io/shodan/host/${encodeURIComponent(raw)}?key=${encodeURIComponent(key)}`, {}, 16000);
      return NextResponse.json(
        {
          target: raw,
          mode: "host",
          ip: data.ip_str || raw,
          org: data.org,
          isp: data.isp,
          asn: data.asn,
          os: data.os,
          country: data.country_name,
          city: data.city,
          hostnames: data.hostnames || [],
          domains: data.domains || [],
          ports: data.ports || [],
          tags: data.tags || [],
          vulns: data.vulns || [],
          lastUpdate: data.last_update,
          services: (data.data || []).slice(0, 20).map((s) => ({
            port: s.port,
            transport: s.transport,
            product: s.product,
            version: s.version,
            module: s.module,
            banner: s.data ? s.data.slice(0, 400) : null,
          })),
          source: `https://www.shodan.io/host/${raw}`,
        },
        { headers: JSON_HEADERS },
      );
    }

    const [dns, ip] = await Promise.allSettled([
      getJson<ShodanDns>(`https://api.shodan.io/dns/domain/${encodeURIComponent(raw)}?key=${encodeURIComponent(key)}`, {}, 16000),
      resolve(raw),
    ]);

    const dnsData = dns.status === "fulfilled" ? dns.value : null;
    let host: ShodanHost | null = null;
    const ipValue = ip.status === "fulfilled" ? ip.value : null;

    if (ipValue) {
      try {
        host = await getJson<ShodanHost>(`https://api.shodan.io/shodan/host/${encodeURIComponent(ipValue)}?key=${encodeURIComponent(key)}`, {}, 16000);
      } catch {
        host = null;
      }
    }

    return NextResponse.json(
      {
        target: raw,
        mode: "domain",
        resolvedIp: ipValue,
        subdomains: (dnsData?.data || [])
          .filter((r) => r.type === "A" || r.type === "AAAA" || r.type === "CNAME")
          .slice(0, 150)
          .map((r) => ({ subdomain: r.subdomain, type: r.type, value: r.value, lastSeen: r.last_seen })),
        tags: dnsData?.tags || [],
        host: host
          ? {
              ip: host.ip_str,
              org: host.org,
              isp: host.isp,
              asn: host.asn,
              os: host.os,
              country: host.country_name,
              city: host.city,
              ports: host.ports || [],
              vulns: host.vulns || [],
              hostnames: host.hostnames || [],
              services: (host.data || []).slice(0, 20).map((s) => ({
                port: s.port,
                transport: s.transport,
                product: s.product,
                version: s.version,
                banner: s.data ? s.data.slice(0, 400) : null,
              })),
            }
          : null,
        source: `https://www.shodan.io/domain/${raw}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    const msg = errMessage(e);
    return NextResponse.json({ error: msg, target: raw }, { status: msg.startsWith("401") || msg.startsWith("403") ? 401 : 502, headers: JSON_HEADERS });
  }
}
