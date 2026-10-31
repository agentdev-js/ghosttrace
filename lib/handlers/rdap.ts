import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";
import { rdapTarget } from "@/lib/rdap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface VCardEntry extends Array<unknown> {
  0: string;
  3: string;
}

interface Entity {
  handle?: string;
  roles?: string[];
  vcardArray?: [string, VCardEntry[]];
  entities?: Entity[];
}

interface RdapResponse {
  handle?: string;
  ldhName?: string;
  name?: string;
  unicodeName?: string;
  status?: string[];
  events?: { eventAction: string; eventDate: string }[];
  entities?: Entity[];
  nameservers?: { ldhName?: string }[];
  secureDNS?: { delegationSigned?: boolean };
  links?: { href: string; rel?: string; type?: string }[];
  notices?: { title?: string; description?: string[] }[];
  startAddress?: string;
  endAddress?: string;
  ipVersion?: string;
  type?: string;
  parentHandle?: string;
}

function vcardValue(entity: Entity, key: string) {
  const card = entity.vcardArray?.[1];
  if (!Array.isArray(card)) return null;
  for (const entry of card) {
    if (Array.isArray(entry) && entry[0] === key) {
      const value = entry[3];
      return typeof value === "string" ? value : null;
    }
  }
  return null;
}

function flattenEntities(entities: Entity[] | undefined, depth = 0): { role: string; name: string | null; email: string | null; handle: string | null }[] {
  if (!entities || depth > 2) return [];
  const out: { role: string; name: string | null; email: string | null; handle: string | null }[] = [];
  for (const e of entities) {
    const roles = e.roles || [];
    for (const role of roles) {
      out.push({
        role,
        name: vcardValue(e, "fn"),
        email: vcardValue(e, "email"),
        handle: e.handle || null,
      });
    }
    out.push(...flattenEntities(e.entities, depth + 1));
  }
  return out.filter((e) => e.name || e.email);
}

function isIp(q: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(q) || (q.includes(":") && /^[0-9a-f:]+$/i.test(q));
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const kind = isIp(q) ? "ip" : "domain";
  const resolved = await rdapTarget(q);
  const url = resolved.url;

  try {
    const data = await getJson<RdapResponse>(url, { redirect: "follow" }, 14000);
    const events: Record<string, string> = {};
    for (const e of data.events || []) if (e.eventAction) events[e.eventAction] = e.eventDate;

    const entities = flattenEntities(data.entities);
    const uniqueEntities = entities.filter((e, i, arr) => arr.findIndex((x) => x.role === e.role && x.name === e.name && x.email === e.email) === i);

    return NextResponse.json(
      {
        target: q,
        kind,
        handle: data.handle || null,
        name: data.unicodeName || data.ldhName || data.name || null,
        status: data.status || [],
        registered: events.registration || null,
        updated: events["last changed"] || events.lastChanged || null,
        expires: events.expiration || null,
        transferred: events.transfer || null,
        nameservers: (data.nameservers || []).map((n) => n.ldhName).filter(Boolean),
        entities: uniqueEntities.slice(0, 25),
        dnssec: data.secureDNS?.delegationSigned ?? null,
        range: data.startAddress ? `${data.startAddress} — ${data.endAddress}` : null,
        ipVersion: data.ipVersion || null,
        type: data.type || null,
        links: (data.links || []).map((l) => l.href).slice(0, 6),
        notices: (data.notices || []).map((n) => ({ title: n.title, description: n.description?.slice(0, 3) })).slice(0, 4),
        source: url,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: q, source: url }, { status: 502, headers: JSON_HEADERS });
  }
}
