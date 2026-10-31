import { NextRequest, NextResponse } from "next/server";
import { getJson, JSON_HEADERS, timedFetch } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface IpWho {
  success?: boolean;
  message?: string;
  ip?: string;
  type?: string;
  continent?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  is_eu?: boolean;
  postal?: string;
  calling_code?: string;
  flag?: { emoji?: string };
  connection?: { asn?: number; org?: string; isp?: string; domain?: string };
  timezone?: { id?: string; abbr?: string; utc?: string };
}

interface IpApiCo {
  ip?: string;
  city?: string;
  region?: string;
  country_name?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asn?: string;
  org?: string;
  postal?: string;
  error?: boolean;
  reason?: string;
}

interface IpInfo {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
  bogon?: boolean;
  error?: { message?: string };
}

interface IpApiCom {
  status?: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
}

function flag(code?: string) {
  if (!code || code.length !== 2) return null;
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

function splitAs(value?: string) {
  if (!value) return { asn: null, org: null };
  const match = value.match(/^(AS\d+)\s+(.*)$/i);
  if (match) return { asn: match[1], org: match[2] || null };
  return { asn: value, org: null };
}

async function resolve(domain: string) {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
  ];
  for (const url of providers) {
    try {
      const res = await getJson<{ Answer?: { data: string }[] }>(url, { headers: { accept: "application/dns-json" } }, 7000);
      const hit = res.Answer?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a.data));
      if (hit) return hit.data;
    } catch {}
  }
  return null;
}

async function lookup(ip: string) {
  try {
    const data = await getJson<IpWho>(`https://ipwho.is/${encodeURIComponent(ip)}`, {}, 8000);
    if (data.success !== false && data.ip) {
      return {
        provider: "ipwho.is",
        ip: data.ip,
        type: data.type,
        continent: data.continent,
        country: data.country,
        countryCode: data.country_code,
        region: data.region,
        city: data.city,
        postal: data.postal,
        coordinates: data.latitude && data.longitude ? { lat: data.latitude, lon: data.longitude } : null,
        timezone: data.timezone,
        asn: data.connection?.asn ? `AS${data.connection.asn}` : null,
        organisation: data.connection?.org,
        isp: data.connection?.isp,
        domain: data.connection?.domain,
        flag: data.flag?.emoji || flag(data.country_code),
        eu: data.is_eu,
        callingCode: data.calling_code,
        source: `https://ipwho.is/${ip}`,
        maps: data.latitude && data.longitude ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : null,
      };
    }
  } catch {}

  try {
    const res = await timedFetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {}, 8000);
    if (res.ok) {
      const data = (await res.json()) as IpApiCo;
      if (!data.error && data.ip) {
        return {
          provider: "ipapi.co",
          ip: data.ip,
          type: null,
          continent: null,
          country: data.country_name,
          countryCode: data.country_code,
          region: data.region,
          city: data.city,
          postal: data.postal,
          coordinates: data.latitude && data.longitude ? { lat: data.latitude, lon: data.longitude } : null,
          timezone: data.timezone ? { id: data.timezone } : null,
          asn: data.asn,
          organisation: data.org,
          isp: data.org,
          domain: null,
          flag: flag(data.country_code),
          eu: null,
          callingCode: null,
          source: `https://ipapi.co/${ip}/`,
          maps: data.latitude && data.longitude ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : null,
        };
      }
    }
  } catch {}

  try {
    const data = await getJson<IpInfo>(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, {}, 8000);
    if (!data.error && !data.bogon && data.ip) {
      const loc = (data.loc || "").split(",");
      const coords = loc.length === 2 ? { lat: Number(loc[0]), lon: Number(loc[1]) } : null;
      const asn = splitAs(data.org);
      return {
        provider: "ipinfo.io",
        ip: data.ip,
        type: null,
        continent: null,
        country: data.country,
        countryCode: data.country,
        region: data.region,
        city: data.city,
        postal: data.postal,
        coordinates: coords,
        timezone: data.timezone ? { id: data.timezone } : null,
        asn: asn.asn,
        organisation: asn.org || data.org,
        isp: asn.org || data.org,
        domain: null,
        flag: flag(data.country),
        eu: null,
        callingCode: null,
        source: `https://ipinfo.io/${ip}`,
        maps: coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lon}` : null,
      };
    }
  } catch {}

  const data = await getJson<IpApiCom>(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
    {},
    8000,
  );
  if (data.status !== "success") throw new Error(data.message || "Lookup failed");
  const asn = splitAs(data.as);
  return {
    provider: "ip-api.com",
    ip: data.query || ip,
    type: null,
    continent: null,
    country: data.country,
    countryCode: data.countryCode,
    region: data.regionName || data.region,
    city: data.city,
    postal: data.zip,
    coordinates: data.lat && data.lon ? { lat: data.lat, lon: data.lon } : null,
    timezone: data.timezone ? { id: data.timezone } : null,
    asn: asn.asn,
    organisation: asn.org || data.org || data.isp,
    isp: data.isp,
    domain: null,
    flag: flag(data.countryCode),
    eu: null,
    callingCode: null,
    source: `https://ip-api.com/#${ip}`,
    maps: data.lat && data.lon ? `https://www.google.com/maps?q=${data.lat},${data.lon}` : null,
  };
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw) || (raw.includes(":") && /^[0-9a-f:]+$/i.test(raw));
  let ip = raw;
  let resolvedFrom: string | null = null;

  try {
    if (!isIp) {
      const found = await resolve(raw);
      if (!found) {
        return NextResponse.json({ error: `No A record for ${raw}`, target: raw }, { status: 404, headers: JSON_HEADERS });
      }
      ip = found;
      resolvedFrom = raw;
    }

    const body = await lookup(ip);
    return NextResponse.json({ target: raw, resolvedFrom, ...body }, { headers: JSON_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, target: raw, hint: "Geo databases are rate-limiting this IP. Retry in a few seconds." },
      { status: 502, headers: JSON_HEADERS },
    );
  }
}
