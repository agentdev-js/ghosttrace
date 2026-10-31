import { getJson } from "./server";

interface Bootstrap {
  services: [string[], string[]][];
}

let cache: { at: number; dns: Bootstrap; v4: Bootstrap; v6: Bootstrap } | null = null;

async function load() {
  if (cache && Date.now() - cache.at < 86_400_000) return cache;
  const [dns, v4, v6] = await Promise.all([
    getJson<Bootstrap>("https://data.iana.org/rdap/dns.json", {}, 10000),
    getJson<Bootstrap>("https://data.iana.org/rdap/ipv4.json", {}, 10000),
    getJson<Bootstrap>("https://data.iana.org/rdap/ipv6.json", {}, 10000),
  ]);
  cache = { at: Date.now(), dns, v4, v6 };
  return cache;
}

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, o) => (acc * 256 + Number(o)) >>> 0, 0) >>> 0;
}

function ipv6ToBigInt(ip: string): bigint {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":").filter(Boolean) : [];
  const t = tail ? tail.split(":").filter(Boolean) : [];
  const fill = Math.max(8 - h.length - t.length, 0);
  const parts = [...h, ...Array(fill).fill("0"), ...t];
  return parts.reduce((acc, p) => (acc << 16n) + BigInt(parseInt(p || "0", 16)), 0n);
}

function matchV4(ip: string, cidr: string) {
  const [net, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw || 32);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(net) & mask);
}

function matchV6(ip: string, cidr: string) {
  const [net, bitsRaw] = cidr.split("/");
  const bits = BigInt(Number(bitsRaw || 128));
  const shift = 128n - bits;
  return ipv6ToBigInt(ip) >> shift === ipv6ToBigInt(net) >> shift;
}

function pick(boot: Bootstrap, matcher: (prefix: string) => boolean) {
  for (const [prefixes, urls] of boot.services) {
    if (prefixes.some(matcher) && urls[0]) return urls[0];
  }
  return null;
}

export async function rdapTarget(query: string) {
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(query) || (query.includes(":") && /^[0-9a-f:]+$/i.test(query));
  try {
    const boot = await load();
    if (!isIp) {
      const tld = query.split(".").pop()?.toLowerCase() || "";
      const base = pick(boot.dns, (p) => p.toLowerCase() === tld);
      if (base) return { url: `${base.replace(/\/$/, "")}/domain/${encodeURIComponent(query)}`, kind: "domain" as const };
    } else if (query.includes(":")) {
      const base = pick(boot.v6, (prefix) => matchV6(query, prefix));
      if (base) return { url: `${base.replace(/\/$/, "")}/ip/${encodeURIComponent(query)}`, kind: "ip" as const };
    } else {
      const base = pick(boot.v4, (prefix) => matchV4(query, prefix));
      if (base) return { url: `${base.replace(/\/$/, "")}/ip/${encodeURIComponent(query)}`, kind: "ip" as const };
    }
  } catch {
    return { url: `https://rdap.org/${isIp ? "ip" : "domain"}/${encodeURIComponent(query)}`, kind: isIp ? ("ip" as const) : ("domain" as const) };
  }
  return { url: `https://rdap.org/${isIp ? "ip" : "domain"}/${encodeURIComponent(query)}`, kind: isIp ? ("ip" as const) : ("domain" as const) };
}
