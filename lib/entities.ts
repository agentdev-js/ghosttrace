import type { EntitySet } from "./types";

const NOISE = new Set([
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "github.com",
  "api.github.com",
  "cloudflare-dns.com",
  "archive.org",
  "web.archive.org",
  "crt.sh",
  "urlscan.io",
  "nvd.nist.gov",
  "services.nvd.nist.gov",
  "api.blockchair.com",
  "blockchair.com",
  "blockchain.com",
  "www.blockchain.com",
  "etherscan.io",
  "api.ethplorer.io",
  "haveibeenpwned.com",
  "virustotal.com",
  "www.virustotal.com",
  "shodan.io",
  "www.shodan.io",
  "npmjs.com",
  "www.npmjs.com",
  "registry.npmjs.org",
  "api.npmjs.org",
  "maclookup.app",
  "api.maclookup.app",
  "macvendors.com",
  "api.macvendors.com",
  "ipwho.is",
  "rdap.org",
  "hunter.io",
  "gravatar.com",
  "bsky.app",
  "t.me",
  "keybase.io",
  "chess.com",
  "api.chess.com",
  "lichess.org",
  "roblox.com",
  "steamcommunity.com",
  "soundcloud.com",
  "vimeo.com",
  "youtube.com",
  "www.youtube.com",
  "reddit.com",
  "www.reddit.com",
  "mastodon.social",
  "dev.to",
  "stackoverflow.com",
  "api.stackexchange.com",
  "codeforces.com",
  "pastebin.com",
  "linktr.ee",
  "behance.net",
  "dribbble.com",
  "flickr.com",
  "gitlab.com",
  "bitbucket.org",
  "pypi.org",
  "news.ycombinator.com",
  "hn.algolia.com",
  "hub.docker.com",
  "exploit-db.com",
  "www.exploit-db.com",
  "censys.io",
  "search.censys.io",
  "apilayer.net",
]);

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_URL = /^https?:\/\/[^\s]+$/i;
const RE_IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const RE_DOMAIN = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/i;
const RE_ETH = /^0x[a-fA-F0-9]{40}$/;
const RE_BTC = /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const RE_HASH = /^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i;

function validIp(v: string) {
  return v.split(".").every((p) => {
    const n = Number(p);
    return p.length > 0 && n >= 0 && n <= 255;
  });
}

export function extractEntities(payloads: unknown[]): EntitySet {
  const domains = new Set<string>();
  const ips = new Set<string>();
  const emails = new Set<string>();
  const urls = new Set<string>();
  const hashes = new Set<string>();
  const wallets = new Set<string>();

  const addDomain = (d: string) => {
    const v = d.toLowerCase().replace(/\.$/, "");
    if (v.length > 3 && !NOISE.has(v) && RE_DOMAIN.test(v)) domains.add(v);
  };

  const walk = (value: unknown, key: string, depth: number) => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === "string") {
      if (key === "source" || value.length > 400) return;
      const s = value.trim();
      if (RE_EMAIL.test(s)) {
        emails.add(s.toLowerCase());
        addDomain(s.split("@")[1]);
        return;
      }
      if (RE_URL.test(s)) {
        urls.add(s);
        try {
          addDomain(new URL(s).hostname);
        } catch {
          return;
        }
        return;
      }
      if (RE_IPV4.test(s) && validIp(s)) {
        ips.add(s);
        return;
      }
      if (RE_ETH.test(s) || RE_BTC.test(s)) {
        wallets.add(s);
        return;
      }
      if (RE_HASH.test(s)) {
        hashes.add(s.toLowerCase());
        return;
      }
      if (RE_DOMAIN.test(s) && !s.includes("@")) addDomain(s);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value.slice(0, 300)) walk(v, key, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === "source" || k === "avatar" || k === "logo" || k === "screenshot") continue;
        walk(v, k, depth + 1);
      }
    }
  };

  for (const p of payloads) walk(p, "", 0);

  return {
    domains: [...domains].slice(0, 60),
    ips: [...ips].slice(0, 40),
    emails: [...emails].slice(0, 40),
    urls: [...urls].slice(0, 40),
    hashes: [...hashes].slice(0, 30),
    wallets: [...wallets].slice(0, 20),
  };
}
