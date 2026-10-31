import { NextRequest, NextResponse } from "next/server";
import { JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const G = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const B = (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
const GH = (q: string) => `https://github.com/search?q=${encodeURIComponent(q)}&type=code`;

interface Dork {
  label: string;
  query: string;
  url: string;
  engine: string;
}

function domainDorks(t: string): Dork[] {
  return [
    { label: "All indexed pages", query: `site:${t}`, url: G(`site:${t}`), engine: "Google" },
    { label: "Subdomains only", query: `site:${t} -www`, url: G(`site:${t} -www`), engine: "Google" },
    { label: "PDF documents", query: `site:${t} filetype:pdf`, url: G(`site:${t} filetype:pdf`), engine: "Google" },
    { label: "Spreadsheets", query: `site:${t} (filetype:xlsx OR filetype:csv OR filetype:xls)`, url: G(`site:${t} (filetype:xlsx OR filetype:csv OR filetype:xls)`), engine: "Google" },
    { label: "Config and secrets", query: `site:${t} (ext:env OR ext:yml OR ext:yaml OR ext:ini OR ext:conf)`, url: G(`site:${t} (ext:env OR ext:yml OR ext:yaml OR ext:ini OR ext:conf)`), engine: "Google" },
    { label: "SQL and log files", query: `site:${t} (ext:sql OR ext:log OR ext:bak)`, url: G(`site:${t} (ext:sql OR ext:log OR ext:bak)`), engine: "Google" },
    { label: "Admin panels", query: `site:${t} inurl:(admin OR login OR dashboard)`, url: G(`site:${t} inurl:(admin OR login OR dashboard)`), engine: "Google" },
    { label: "Open directory", query: `site:${t} intitle:"index of"`, url: G(`site:${t} intitle:"index of"`), engine: "Google" },
    { label: "Leaked credentials", query: `site:${t} (intext:password OR intext:api_key OR intext:secret)`, url: G(`site:${t} (intext:password OR intext:api_key OR intext:secret)`), engine: "Google" },
    { label: "Mentions elsewhere", query: `"${t}" -site:${t}`, url: G(`"${t}" -site:${t}`), engine: "Google" },
    { label: "Email addresses", query: `"@${t}"`, url: G(`"@${t}"`), engine: "Google" },
    { label: "GitHub code", query: `"${t}"`, url: GH(`"${t}"`), engine: "GitHub" },
    { label: "Pastebin leaks", query: `site:pastebin.com "${t}"`, url: G(`site:pastebin.com "${t}"`), engine: "Google" },
    { label: "LinkedIn people", query: `site:linkedin.com "${t}"`, url: G(`site:linkedin.com "${t}"`), engine: "Google" },
    { label: "Bing index", query: `site:${t}`, url: B(`site:${t}`), engine: "Bing" },
  ];
}

function usernameDorks(t: string): Dork[] {
  return [
    { label: "Exact handle", query: `"${t}"`, url: G(`"${t}"`), engine: "Google" },
    { label: "Handle plus contact", query: `"${t}" (email OR contact OR phone OR address)`, url: G(`"${t}" (email OR contact OR phone OR address)`), engine: "Google" },
    { label: "At-mentions", query: `"@${t}"`, url: G(`"@${t}"`), engine: "Google" },
    { label: "GitHub code", query: `"${t}"`, url: GH(`"${t}"`), engine: "GitHub" },
    { label: "Pastebin", query: `site:pastebin.com "${t}"`, url: G(`site:pastebin.com "${t}"`), engine: "Google" },
    { label: "LinkedIn", query: `site:linkedin.com "${t}"`, url: G(`site:linkedin.com "${t}"`), engine: "Google" },
    { label: "Reddit", query: `site:reddit.com "${t}"`, url: G(`site:reddit.com "${t}"`), engine: "Google" },
    { label: "Documents", query: `"${t}" (filetype:pdf OR filetype:doc OR filetype:xlsx)`, url: G(`"${t}" (filetype:pdf OR filetype:doc OR filetype:xlsx)`), engine: "Google" },
    { label: "Forum posts", query: `"${t}" (forum OR profile OR member)`, url: G(`"${t}" (forum OR profile OR member)`), engine: "Google" },
    { label: "Bing exact", query: `"${t}"`, url: B(`"${t}"`), engine: "Bing" },
  ];
}

function emailDorks(t: string): Dork[] {
  const domain = t.split("@")[1] || t;
  return [
    { label: "Exact address", query: `"${t}"`, url: G(`"${t}"`), engine: "Google" },
    { label: "Address in documents", query: `"${t}" (filetype:pdf OR filetype:doc OR filetype:xlsx)`, url: G(`"${t}" (filetype:pdf OR filetype:doc OR filetype:xlsx)`), engine: "Google" },
    { label: "Leak mentions", query: `"${t}" (password OR leak OR dump OR combo)`, url: G(`"${t}" (password OR leak OR dump OR combo)`), engine: "Google" },
    { label: "Pastebin", query: `"${t}" site:pastebin.com`, url: G(`"${t}" site:pastebin.com`), engine: "Google" },
    { label: "Sibling addresses", query: `"@${domain}"`, url: G(`"@${domain}"`), engine: "Google" },
    { label: "Breach lookup", query: t, url: `https://haveibeenpwned.com/account/${encodeURIComponent(t)}`, engine: "HIBP" },
    { label: "GitHub commits", query: `"${t}"`, url: GH(`"${t}"`), engine: "GitHub" },
    { label: "Gravatar", query: t, url: `https://gravatar.com/${t}`, engine: "Gravatar" },
  ];
}

function ipDorks(t: string): Dork[] {
  return [
    { label: "Exact IP", query: `"${t}"`, url: G(`"${t}"`), engine: "Google" },
    { label: "Shodan host", query: t, url: `https://www.shodan.io/host/${t}`, engine: "Shodan" },
    { label: "Censys search", query: t, url: `https://search.censys.io/search?resource=hosts&q=${encodeURIComponent(t)}`, engine: "Censys" },
    { label: "URLScan", query: `ip:${t}`, url: `https://urlscan.io/search/#${encodeURIComponent("ip:" + t)}`, engine: "URLScan" },
    { label: "Abuse reports", query: `"${t}" (abuse OR blacklist OR spam)`, url: G(`"${t}" (abuse OR blacklist OR spam)`), engine: "Google" },
    { label: "Reverse DNS", query: t, url: `https://www.google.com/search?q=${encodeURIComponent(t)}`, engine: "Google" },
  ];
}

function cveDorks(t: string): Dork[] {
  const id = t.toUpperCase();
  return [
    { label: "NVD detail", query: id, url: `https://nvd.nist.gov/vuln/detail/${id}`, engine: "NVD" },
    { label: "Exploit availability", query: `"${id}" exploit`, url: G(`"${id}" exploit`), engine: "Google" },
    { label: "Public PoC", query: `"${id}" poc`, url: GH(`"${id}"`), engine: "GitHub" },
    { label: "Nuclei template", query: `"${id}" nuclei`, url: GH(`"${id}" nuclei`), engine: "GitHub" },
    { label: "Exploit-DB", query: id, url: `https://www.exploit-db.com/search?cve=${encodeURIComponent(id.replace("CVE-", ""))}`, engine: "Exploit-DB" },
    { label: "Vendor advisories", query: `"${id}" advisory`, url: G(`"${id}" advisory`), engine: "Google" },
  ];
}

function phoneDorks(t: string): Dork[] {
  const digits = t.replace(/[^\d+]/g, "");
  return [
    { label: "Exact number", query: `"${digits}"`, url: G(`"${digits}"`), engine: "Google" },
    { label: "Messaging apps", query: `"${digits}" (whatsapp OR telegram)`, url: G(`"${digits}" (whatsapp OR telegram)`), engine: "Google" },
    { label: "Social posts", query: `"${digits}" (facebook OR instagram OR twitter)`, url: G(`"${digits}" (facebook OR instagram OR twitter)`), engine: "Google" },
    { label: "Classifieds", query: `"${digits}" (olx OR craigslist OR classified)`, url: G(`"${digits}" (olx OR craigslist OR classified)`), engine: "Google" },
    { label: "Documents", query: `"${digits}" filetype:pdf`, url: G(`"${digits}" filetype:pdf`), engine: "Google" },
  ];
}

function chainDorks(t: string, chain: string): Dork[] {
  const base =
    chain === "bitcoin"
      ? [`https://blockchair.com/bitcoin/address/${t}`, `https://www.blockchain.com/explorer/addresses/btc/${t}`]
      : [`https://blockchair.com/ethereum/address/${t}`, `https://etherscan.io/address/${t}`];
  return [
    { label: "Exact address", query: `"${t}"`, url: G(`"${t}"`), engine: "Google" },
    { label: "Blockchair", query: t, url: base[0], engine: "Blockchair" },
    { label: "Explorer", query: t, url: base[1], engine: chain === "bitcoin" ? "Blockchain.com" : "Etherscan" },
    { label: "Forums and leaks", query: `"${t}" (scam OR ransom OR forum)`, url: G(`"${t}" (scam OR ransom OR forum)`), engine: "Google" },
    { label: "GitHub mentions", query: `"${t}"`, url: GH(`"${t}"`), engine: "GitHub" },
  ];
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  const type = (req.nextUrl.searchParams.get("type") || "unknown").toLowerCase();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  let dorks: Dork[] = [];
  if (type === "domain" || type === "url") dorks = domainDorks(raw.replace(/^https?:\/\//, "").split("/")[0]);
  else if (type === "username") dorks = usernameDorks(raw.replace(/^@/, ""));
  else if (type === "email") dorks = emailDorks(raw);
  else if (type === "ip") dorks = ipDorks(raw);
  else if (type === "cve") dorks = cveDorks(raw);
  else if (type === "phone") dorks = phoneDorks(raw);
  else if (type === "btc") dorks = chainDorks(raw, "bitcoin");
  else if (type === "eth") dorks = chainDorks(raw, "ethereum");
  else dorks = usernameDorks(raw);

  return NextResponse.json({ target: raw, type, count: dorks.length, dorks }, { headers: JSON_HEADERS });
}
