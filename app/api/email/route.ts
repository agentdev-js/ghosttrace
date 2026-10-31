import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmail.net",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "mintemail.com",
  "mohmal.com",
  "fakeinbox.com",
  "emailondeck.com",
  "moakt.com",
  "burnermail.io",
  "mailnesia.com",
  "spambog.com",
  "discard.email",
  "mailcatch.com",
  "tempinbox.com",
  "throwam.com",
  "mailsac.com",
  "inboxkitten.com",
  "emailfake.com",
  "generator.email",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "instantemailaddress.com",
  "tempail.com",
  "mail-temp.com",
  "mytemp.email",
  "temp-mail.io",
  "mailslurp.com",
  "temporary-mail.net",
  "byom.de",
]);

const ROLE = new Set([
  "admin",
  "administrator",
  "info",
  "support",
  "sales",
  "contact",
  "hello",
  "team",
  "billing",
  "hr",
  "jobs",
  "careers",
  "press",
  "media",
  "security",
  "abuse",
  "postmaster",
  "webmaster",
  "hostmaster",
  "noreply",
  "no-reply",
  "donotreply",
  "root",
  "help",
  "service",
  "office",
  "marketing",
  "legal",
  "privacy",
  "compliance",
  "accounts",
  "payments",
  "orders",
  "returns",
]);

const PROVIDERS: [string, RegExp][] = [
  ["Gmail", /(^|\.)googlemail\.com$|(^|\.)gmail\.com$/i],
  ["Outlook / Hotmail", /(^|\.)outlook\.com$|(^|\.)hotmail\.com$|(^|\.)live\.com$|(^|\.)msn\.com$/i],
  ["Yahoo", /(^|\.)yahoo\.[a-z.]+$/i],
  ["Proton Mail", /(^|\.)proton\.me$|(^|\.)protonmail\.com$|(^|\.)pm\.me$/i],
  ["iCloud", /(^|\.)icloud\.com$|(^|\.)me\.com$|(^|\.)mac\.com$/i],
  ["Zoho", /(^|\.)zoho\.com$/i],
  ["Yandex", /(^|\.)yandex\.[a-z.]+$/i],
  ["GMX", /(^|\.)gmx\.[a-z.]+$/i],
  ["Fastmail", /(^|\.)fastmail\.[a-z.]+$/i],
  ["Tutanota", /(^|\.)tutanota\.[a-z.]+$|(^|\.)tuta\.io$/i],
  ["AOL", /(^|\.)aol\.com$/i],
];

function md5(v: string) {
  return createHash("md5").update(v).digest("hex");
}

async function mxRecords(domain: string) {
  const data = await getJson<{ Answer?: { data: string }[] }>(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
    { headers: { accept: "application/dns-json" } },
    8000,
  );
  return (data.Answer || [])
    .map((a) => {
      const parts = a.data.trim().split(/\s+/);
      return { priority: Number(parts[0]), host: parts[parts.length - 1].replace(/\.$/, "") };
    })
    .filter((r) => r.host)
    .sort((a, b) => a.priority - b.priority);
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const email = raw.toLowerCase();
  const validSyntax = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!validSyntax) {
    return NextResponse.json({ target: raw, validSyntax: false, error: "Malformed email address" }, { status: 400, headers: JSON_HEADERS });
  }

  const [local, domain] = email.split("@");
  const provider = PROVIDERS.find(([, re]) => re.test(domain))?.[0] || null;
  const disposable = DISPOSABLE.has(domain) || /(temp|trash|throwaway|disposable|10minute|guerrilla|yopmail)/i.test(domain);
  const role = ROLE.has(local.split("+")[0]);
  const plusTag = local.includes("+") ? local.split("+").slice(1).join("+") : null;
  const normalizedLocal = local.split("+")[0].replace(/\./g, "");

  let mx: { priority: number; host: string }[] = [];
  let mxError: string | null = null;
  try {
    mx = await mxRecords(domain);
  } catch (e) {
    mxError = errMessage(e);
  }

  const hash = md5(email);
  const gravatarUrl = `https://gravatar.com/avatar/${hash}?d=404&s=200`;

  let gravatarExists: boolean | null = null;
  let gravatarProfile: Record<string, unknown> | null = null;
  try {
    const res = await fetch(gravatarUrl, { method: "GET", cache: "no-store", redirect: "follow" });
    gravatarExists = res.status === 200;
  } catch {
    gravatarExists = null;
  }

  if (gravatarExists) {
    try {
      gravatarProfile = await getJson<Record<string, unknown>>(`https://gravatar.com/${hash}.json`, {}, 8000);
    } catch {
      gravatarProfile = null;
    }
  }

  return NextResponse.json(
    {
      target: email,
      validSyntax,
      localPart: local,
      domain,
      normalizedAlias: `${normalizedLocal}@${domain}`,
      plusTag,
      provider,
      gravatar: {
        hash,
        exists: gravatarExists,
        url: gravatarUrl,
        profile: gravatarProfile,
      },
      mx,
      mxError,
      deliverable: mx.length > 0,
      disposable,
      roleAccount: role,
      riskFlags: [
        ...(disposable ? ["disposable domain"] : []),
        ...(role ? ["role account"] : []),
        ...(mx.length === 0 ? ["no MX records"] : []),
        ...(plusTag ? ["plus-addressed"] : []),
      ],
      source: `https://gravatar.com/${hash}`,
    },
    { headers: JSON_HEADERS },
  );
}
