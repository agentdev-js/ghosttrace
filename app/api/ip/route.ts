import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

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
  region_code?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  is_eu?: boolean;
  postal?: string;
  calling_code?: string;
  capital?: string;
  borders?: string;
  flag?: { emoji?: string; unicode?: string };
  connection?: { asn?: number; org?: string; isp?: string; domain?: string };
  timezone?: { id?: string; abbr?: string; utc?: string; current_time?: string };
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

  const isDomain = !/^(\d{1,3}\.){3}\d{1,3}$/.test(raw) && !(raw.includes(":") && /^[0-9a-f:]+$/i.test(raw));
  let ip = raw;
  let resolvedFrom: string | null = null;

  try {
    if (isDomain) {
      const found = await resolve(raw);
      if (!found) {
        return NextResponse.json({ error: `No A record for ${raw}`, target: raw }, { status: 404, headers: JSON_HEADERS });
      }
      ip = found;
      resolvedFrom = raw;
    }

    const data = await getJson<IpWho>(`https://ipwho.is/${encodeURIComponent(ip)}`, {}, 9000);
    if (data.success === false) throw new Error(data.message || "Lookup failed");

    return NextResponse.json(
      {
        target: raw,
        resolvedFrom,
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
        asn: data.connection?.asn,
        organisation: data.connection?.org,
        isp: data.connection?.isp,
        domain: data.connection?.domain,
        flag: data.flag?.emoji,
        eu: data.is_eu,
        callingCode: data.calling_code,
        source: `https://ipwho.is/${ip}`,
        maps: data.latitude && data.longitude ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : null,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: raw }, { status: 502, headers: JSON_HEADERS });
  }
}
