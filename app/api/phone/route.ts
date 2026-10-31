import { NextRequest, NextResponse } from "next/server";
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, isSupportedCountry } from "libphonenumber-js";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REGION_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  IN: "India",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  BR: "Brazil",
  MX: "Mexico",
  RU: "Russia",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  PK: "Pakistan",
  BD: "Bangladesh",
  NP: "Nepal",
  LK: "Sri Lanka",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  TH: "Thailand",
  VN: "Vietnam",
  TR: "Turkey",
  ZA: "South Africa",
  NG: "Nigeria",
  EG: "Egypt",
  KE: "Kenya",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  PT: "Portugal",
  IE: "Ireland",
  NZ: "New Zealand",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  UA: "Ukraine",
  IL: "Israel",
  IR: "Iran",
  IQ: "Iraq",
  QA: "Qatar",
  KW: "Kuwait",
};

interface Numverify {
  valid?: boolean;
  number?: string;
  local_format?: string;
  international_format?: string;
  country_prefix?: string;
  country_code?: string;
  country_name?: string;
  location?: string;
  carrier?: string;
  line_type?: string;
}

function typeLabel(t?: string) {
  switch (t) {
    case "MOBILE":
      return "Mobile";
    case "FIXED_LINE":
      return "Fixed line";
    case "FIXED_LINE_OR_MOBILE":
      return "Fixed line or mobile";
    case "TOLL_FREE":
      return "Toll free";
    case "PREMIUM_RATE":
      return "Premium rate";
    case "SHARED_COST":
      return "Shared cost";
    case "VOIP":
      return "VoIP";
    case "PERSONAL_NUMBER":
      return "Personal number";
    case "PAGER":
      return "Pager";
    case "UAN":
      return "UAN";
    case "VOICEMAIL":
      return "Voicemail";
    default:
      return t || null;
  }
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const hinted = (req.nextUrl.searchParams.get("region") || "").toUpperCase();
  const candidates = hinted && isSupportedCountry(hinted) ? [hinted] : ["IN", "US", "GB", "AE", "CA", "AU"];

  let phone: ReturnType<typeof parsePhoneNumberFromString> = undefined;
  let usedRegion: string | null = null;

  if (raw.startsWith("+")) {
    phone = parsePhoneNumberFromString(raw);
    usedRegion = phone?.country || null;
  } else {
    for (const region of candidates) {
      const parsed = parsePhoneNumberFromString(raw, region as never);
      if (parsed?.isValid()) {
        phone = parsed;
        usedRegion = region;
        break;
      }
      if (!phone && parsed) {
        phone = parsed;
        usedRegion = region;
      }
    }
  }

  if (!phone) {
    return NextResponse.json({ target: raw, valid: false, error: "Could not parse the number" }, { status: 400, headers: JSON_HEADERS });
  }

  const key = req.headers.get("x-numverify-key") || process.env.NUMVERIFY_API_KEY || "";
  let carrier: Numverify | null = null;
  let carrierError: string | null = null;

  if (key) {
    try {
      const data = await getJson<Numverify>(
        `https://apilayer.net/api/validate?access_key=${encodeURIComponent(key)}&number=${encodeURIComponent(phone.number)}&format=1`,
        {},
        9000,
      );
      if (data && data.valid !== undefined) carrier = data;
      else carrierError = "Numverify rejected the key or quota";
    } catch (e) {
      carrierError = errMessage(e);
    }
  }

  const callingCode = phone.country ? getCountryCallingCode(phone.country) : null;
  const region = phone.country || null;
  const type = phone.getType();
  const possible = phone.isPossible();
  const valid = phone.isValid();

  return NextResponse.json(
    {
      target: raw,
      valid,
      possible,
      country: region,
      countryName: region ? REGION_NAMES[region] || region : null,
      callingCode: callingCode ? `+${callingCode}` : null,
      nationalNumber: phone.nationalNumber,
      international: phone.formatInternational(),
      national: phone.formatNational(),
      rfc3966: phone.getURI(),
      type: typeLabel(type),
      regionHint: usedRegion,
      carrier: carrier
        ? {
            name: carrier.carrier || null,
            lineType: carrier.line_type || null,
            location: carrier.location || null,
            countryName: carrier.country_name || null,
            source: "Numverify",
          }
        : null,
      carrierError,
      supportedCountries: getCountries().length,
      source: "libphonenumber",
    },
    { headers: JSON_HEADERS },
  );
}
