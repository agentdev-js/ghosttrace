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

interface InternetDb {
  ip?: string;
  ports?: number[];
  hostnames?: string[];
  cpes?: string[];
  tags?: string[];
  vulns?: string[];
}

async function resolve(domain: string) {
  const res = await getJson<{ Answer?: { data: string }[] }>(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
    { headers: { accept: "application/dns-json" } },
    7000,
  );
  return res.Answer?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a.data))?.data || null;
}

async function internetDb(ip: string) {
  return getJson<InternetDb>(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {}, 12000);
}

function hostBody(target: string, ip: string, data: InternetDb | null) {
  const ipTarget = /^(\d{1,3}\.){3}\d{1,3}$/.test(target) || (target.includes(":") && /^[0-9a-f:]+$/i.test(target));
  const hostnames = (data?.hostnames || []).filter(
    (h) => ipTarget || h === target || h.endsWith(`.${target}`),
  );
  return {
    target,
    mode: "host",
    provider: "Shodan InternetDB",
    ip: data?.ip || ip,
    ports: data?.ports || [],
    hostnames,
    tags: data?.tags || [],
    vulns: data?.vulns || [],
    cpes: data?.cpes || [],
    services: (data?.ports || []).map((port) => ({ port })),
    note: "Keyless InternetDB record. Add a Shodan key for banners, organisation and history.",
    source: `https://www.shodan.io/host/${ip}`,
  };
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const key = req.headers.get("x-shodan-key") || process.env.SHODAN_API_KEY || "";
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw);

  if (key) {
    try {
      if (isIp) {
        const data = await getJson<ShodanHost>(`https://api.shodan.io/shodan/host/${encodeURIComponent(raw)}?key=${encodeURIComponent(key)}`, {}, 16000);
        return NextResponse.json(
          {
            target: raw,
            mode: "host",
            provider: "Shodan API",
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
          provider: "Shodan API",
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
    } catch {
      const ip = isIp ? raw : await resolve(raw).catch(() => null);
      if (!ip) {
        return NextResponse.json(
          { target: raw, provider: "Shodan InternetDB", resolvedIp: null, ports: [], note: "Domain did not resolve to an IPv4 address.", source: `https://www.shodan.io/domain/${raw}` },
          { headers: JSON_HEADERS },
        );
      }
      const data = await internetDb(ip).catch(() => null);
      return NextResponse.json(hostBody(raw, ip, data), { headers: JSON_HEADERS });
    }
  }

  const ip = isIp ? raw : await resolve(raw).catch(() => null);
  if (!ip) {
    return NextResponse.json(
      {
        target: raw,
        provider: "Shodan InternetDB",
        resolvedIp: null,
        ports: [],
        note: "Domain did not resolve to an IPv4 address. Try a different host or add a Shodan key.",
        source: `https://www.shodan.io/domain/${raw}`,
      },
      { headers: JSON_HEADERS },
    );
  }

  try {
    const data = await internetDb(ip);
    return NextResponse.json(hostBody(raw, ip, data), { headers: JSON_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: raw, provider: "Shodan InternetDB" }, { status: 502, headers: JSON_HEADERS });
  }
}
