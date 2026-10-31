export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export async function timedFetch(url: string, init: RequestInit = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: "application/json, text/plain, */*",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T = unknown>(url: string, init: RequestInit = {}, ms = 12000): Promise<T> {
  const res = await timedFetch(url, init, ms);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(res.status, text.slice(0, 300) || res.statusText);
  }
  return (await res.json()) as T;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errMessage(e: unknown) {
  if (e instanceof HttpError) return `${e.status} ${e.message}`.trim();
  if (e instanceof Error) {
    if (e.name === "AbortError") return "Upstream timed out";
    return e.message;
  }
  return String(e);
}

export function pick<T extends Record<string, unknown>>(obj: T, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function toList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[];
  if (typeof v === "string") return [v];
  return [];
}
