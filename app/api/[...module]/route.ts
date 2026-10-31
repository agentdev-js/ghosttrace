import { NextRequest, NextResponse } from "next/server";
import { GET as crtsh } from "@/lib/handlers/crtsh";
import { GET as crypto } from "@/lib/handlers/crypto";
import { GET as cve } from "@/lib/handlers/cve";
import { GET as dns } from "@/lib/handlers/dns";
import { GET as dorks } from "@/lib/handlers/dorks";
import { GET as email } from "@/lib/handlers/email";
import { GET as github } from "@/lib/handlers/github";
import { GET as hibp } from "@/lib/handlers/hibp";
import { GET as hunter } from "@/lib/handlers/hunter";
import { GET as ip } from "@/lib/handlers/ip";
import { GET as mac } from "@/lib/handlers/mac";
import { GET as npm } from "@/lib/handlers/npm";
import { GET as phone } from "@/lib/handlers/phone";
import { GET as rdap } from "@/lib/handlers/rdap";
import { GET as shodan } from "@/lib/handlers/shodan";
import { GET as urlscan } from "@/lib/handlers/urlscan";
import { GET as username } from "@/lib/handlers/username";
import { GET as virustotal } from "@/lib/handlers/virustotal";
import { GET as wayback } from "@/lib/handlers/wayback";
import { JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HANDLERS: Record<string, (req: NextRequest) => Promise<NextResponse>> = {
  crtsh,
  crypto,
  cve,
  dns,
  dorks,
  email,
  github,
  hibp,
  hunter,
  ip,
  mac,
  npm,
  phone,
  rdap,
  shodan,
  urlscan,
  username,
  virustotal,
  wayback,
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ module: string[] }> }) {
  const params = await ctx.params;
  const name = (params.module?.[0] || "").toLowerCase();
  const handler = HANDLERS[name];
  if (!handler) {
    return NextResponse.json(
      { error: `Unknown module: ${name || "none"}`, modules: Object.keys(HANDLERS) },
      { status: 404, headers: JSON_HEADERS },
    );
  }
  return handler(req);
}
