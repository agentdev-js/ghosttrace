export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function clamp(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function prettyJson(v: unknown) {
  return JSON.stringify(v, null, 2);
}

export async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    return false;
  }
}

export function isUrl(s: string) {
  return /^https?:\/\/[^\s]+$/i.test(s);
}

export function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(s);
}

export function fmtDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtNumber(n: number) {
  return n.toLocaleString("en-US");
}
