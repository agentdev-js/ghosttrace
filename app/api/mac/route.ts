import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS, timedFetch } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface MacLookup {
  success?: boolean;
  found?: boolean;
  macPrefix?: string;
  mac?: string;
  company?: string;
  address?: string;
  country?: string;
  blockStart?: string;
  blockEnd?: string;
  blockSize?: number;
  blockType?: string;
  updated?: string;
  isRand?: boolean;
  isPrivate?: boolean;
  error?: string;
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const clean = raw.replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (clean.length < 6) {
    return NextResponse.json({ error: "MAC address needs at least 3 octets" }, { status: 400, headers: JSON_HEADERS });
  }

  const prefix = clean.slice(0, 6).match(/.{2}/g)?.join(":") || clean;

  try {
    const data = await getJson<MacLookup>(`https://api.maclookup.app/v2/macs/${prefix}`, {}, 9000);
    return NextResponse.json(
      {
        target: raw,
        prefix,
        found: Boolean(data.found),
        company: data.company || null,
        address: data.address || null,
        country: data.country || null,
        blockStart: data.blockStart || null,
        blockEnd: data.blockEnd || null,
        blockSize: data.blockSize || null,
        blockType: data.blockType || null,
        random: data.isRand ?? null,
        private: data.isPrivate ?? null,
        updated: data.updated || null,
        source: `https://maclookup.app/search/result?mac=${prefix}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch {
    try {
      const res = await timedFetch(`https://api.macvendors.com/${prefix}`, {}, 8000);
      if (res.status === 200) {
        const vendor = (await res.text()).trim();
        return NextResponse.json({ target: raw, prefix, found: true, company: vendor, source: "macvendors.com" }, { headers: JSON_HEADERS });
      }
      return NextResponse.json({ target: raw, prefix, found: false, company: null }, { headers: JSON_HEADERS });
    } catch (e) {
      return NextResponse.json({ error: errMessage(e), target: raw }, { status: 502, headers: JSON_HEADERS });
    }
  }
}
