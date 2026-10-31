import type { Keys, KeyName } from "./types";

const STORAGE_KEY = "ghosttrace.keys";

export const KEY_META: { id: KeyName; label: string; hint: string; placeholder: string }[] = [
  { id: "shodan", label: "Shodan", hint: "Host banners, open ports, vulns", placeholder: "Shodan API key" },
  { id: "virustotal", label: "VirusTotal", hint: "Reputation and detections", placeholder: "VT API key" },
  { id: "hibp", label: "Have I Been Pwned", hint: "Breach lookup by email", placeholder: "HIBP API key" },
  { id: "hunter", label: "Hunter.io", hint: "Domain email discovery", placeholder: "Hunter API key" },
  { id: "numverify", label: "Numverify", hint: "Carrier resolution for phone numbers", placeholder: "Numverify API key" },
  { id: "github", label: "GitHub Token", hint: "Raises the rate limit from 60 to 5000 req/h", placeholder: "ghp_..." },
];

export const EMPTY_KEYS: Keys = {
  shodan: "",
  virustotal: "",
  hibp: "",
  hunter: "",
  numverify: "",
  github: "",
};

export function loadKeys(): Keys {
  if (typeof window === "undefined") return { ...EMPTY_KEYS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_KEYS };
    const parsed = JSON.parse(raw) as Partial<Keys>;
    return { ...EMPTY_KEYS, ...parsed };
  } catch {
    return { ...EMPTY_KEYS };
  }
}

export function saveKeys(keys: Keys) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function keyHeaders(keys: Keys): Record<string, string> {
  const h: Record<string, string> = {};
  if (keys.shodan) h["x-shodan-key"] = keys.shodan;
  if (keys.virustotal) h["x-vt-key"] = keys.virustotal;
  if (keys.hibp) h["x-hibp-key"] = keys.hibp;
  if (keys.hunter) h["x-hunter-key"] = keys.hunter;
  if (keys.numverify) h["x-numverify-key"] = keys.numverify;
  if (keys.github) h["x-github-token"] = keys.github;
  return h;
}
