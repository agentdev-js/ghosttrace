import type { TargetType } from "./types";

const RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  cve: /^CVE-\d{4}-\d{4,}$/i,
  eth: /^0x[a-fA-F0-9]{40}$/,
  btc: /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  md5: /^[a-f0-9]{32}$/i,
  sha1: /^[a-f0-9]{40}$/i,
  sha256: /^[a-f0-9]{64}$/i,
  mac: /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  domain: /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/i,
  url: /^https?:\/\/[^\s]+$/i,
  package: /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i,
  username: /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,37}[a-zA-Z0-9])?$/,
  phone: /^\+?[\d\s().-]{7,20}$/,
};

function validIpv4(v: string) {
  return v.split(".").every((p) => {
    const n = Number(p);
    return p.length > 0 && n >= 0 && n <= 255 && String(n) === String(Number(p));
  });
}

function isIpv6(v: string) {
  if (!v.includes(":")) return false;
  if (!/^[0-9a-f:]+$/i.test(v)) return false;
  if (v.split(":").length < 3) return false;
  return v.length <= 45;
}

function isPersonName(v: string) {
  if (!/\s/.test(v)) return false;
  if (v.length < 3 || v.length > 64) return false;
  if (!/^[A-Za-z][A-Za-z\s.'-]+$/.test(v)) return false;
  const words = v.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 5;
}

export function detectType(raw: string): TargetType {
  const v = raw.trim();
  if (!v) return "unknown";
  if (RE.url.test(v)) return "url";
  if (RE.email.test(v)) return "email";
  if (RE.cve.test(v)) return "cve";
  if (RE.eth.test(v)) return "eth";
  if (RE.btc.test(v)) return "btc";
  if (RE.mac.test(v)) return "mac";
  if (RE.ipv4.test(v)) return validIpv4(v) ? "ip" : "unknown";
  if (isIpv6(v)) return "ip";
  if (RE.sha256.test(v) || RE.sha1.test(v) || RE.md5.test(v)) return "hash";
  if (RE.domain.test(v)) return "domain";
  if (v.startsWith("@") && RE.package.test(v.slice(1))) return "package";
  if (RE.phone.test(v)) {
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return "phone";
  }
  if (v.startsWith("@") && RE.username.test(v.slice(1))) return "username";
  if (RE.username.test(v)) return "username";
  if (isPersonName(v)) return "person";
  return "unknown";
}

export function normalizeTarget(raw: string, type: TargetType) {
  const v = raw.trim();
  if (type === "username" && v.startsWith("@")) return v.slice(1);
  if (type === "domain") return v.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (type === "url") return v;
  return v;
}

export function extractDomainFromUrl(v: string) {
  try {
    return new URL(v).hostname;
  } catch {
    return v.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export const TYPE_LABEL: Record<TargetType, string> = {
  domain: "Domain",
  ip: "IP address",
  email: "Email",
  username: "Username",
  person: "Name",
  phone: "Phone",
  btc: "Bitcoin",
  eth: "Ethereum",
  cve: "CVE",
  hash: "Hash",
  package: "Package",
  mac: "MAC address",
  url: "URL",
  unknown: "Unknown",
};
