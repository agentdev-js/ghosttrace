export type TargetType =
  | "domain"
  | "ip"
  | "email"
  | "username"
  | "phone"
  | "btc"
  | "eth"
  | "cve"
  | "hash"
  | "package"
  | "mac"
  | "url"
  | "unknown";

export type ModuleCategory = "Network" | "Web" | "Identity" | "Social" | "Threat" | "Utility";

export type KeyName = "shodan" | "virustotal" | "hibp" | "hunter" | "numverify" | "github";

export interface ModuleDef {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  accepts: TargetType[];
  icon: string;
  endpoint: string;
  needsKey?: KeyName;
  placeholder?: string;
}

export interface FeedItem {
  id: string;
  moduleId: string;
  target: string;
  status: "running" | "done" | "error";
  startedAt: number;
  duration?: number;
  data?: unknown;
  error?: string;
}

export interface HistoryEntry {
  target: string;
  type: TargetType;
  at: number;
}

export type Keys = Record<KeyName, string>;

export interface EntitySet {
  domains: string[];
  ips: string[];
  emails: string[];
  urls: string[];
  hashes: string[];
  wallets: string[];
}
