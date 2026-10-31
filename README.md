# GhostTrace

An OSINT workstation for one target at a time. Enter a domain, IP, email, handle, name, phone number, wallet, MAC or CVE and GhostTrace fans it out across every compatible source, streaming the evidence into a single investigation log.

Live at [ghosttrace-zeta.vercel.app](https://ghosttrace-zeta.vercel.app).

## Sources

Every source runs without an API key. Optional keys add depth.

| Module | Accepts | Primary source | Optional key |
| --- | --- | --- | --- |
| DNS Recon | domain | Cloudflare DoH | — |
| WHOIS / RDAP | domain, ip | IANA bootstrap, Verisign, PIR | — |
| IP Intelligence | ip, domain | ipwho.is, ipapi.co, ipinfo.io, ip-api.com | — |
| Certificate Transparency | domain | crt.sh, Cert Spotter | — |
| Wayback Machine | domain, url | archive.org CDX | — |
| URLScan.io | domain, url, ip | urlscan.io | — |
| Dork Forge | any | generated queries | — |
| Email Intelligence | email | DNS, Gravatar, provider patterns | — |
| Phone Intelligence | phone | libphonenumber metadata | Numverify |
| Crypto Address | btc, eth | Blockchair, Ethplorer | — |
| Domain Contacts | domain | MX, homepage and security.txt extraction, pattern engine | Hunter.io |
| Username Sweep | username | 30 public platforms | — |
| GitHub Recon | username, name | GitHub API and user search | GitHub token |
| CVE Lookup | cve | NVD | — |
| Attack Surface | ip, domain | Shodan InternetDB, Shodan API | Shodan |
| Threat Reputation | ip, domain, hash, url | AlienVault OTX, URLScan fallback, VirusTotal | VirusTotal |
| Breach Exposure | email | XposedOrNot, LeakCheck, HIBP | HIBP |
| MAC Vendor | mac | maclookup.app | — |
| npm Package | package, username | npm registry | — |

Fallback chains are deliberate: if a registry, feed or CDN is throttled, the next keyless source answers instead of returning an empty card. Errors are surfaced with the upstream response so nothing looks silently broken.

## Architecture

- Next.js 15 App Router, React 19, TypeScript. Hand-written CSS, no framework.
- One catch-all server route proxies every third-party call, keeping the deployment inside the Vercel Hobby function limit and avoiding CORS.
- Client layout: source rail, categorized source library, target console, streaming result feed and an entity pivot index.
- Interface type: IBM Plex Sans for labels, IBM Plex Mono for data, brass accent on graphite, square corners and report-style tables. No gradients, glow or chat bubbles.
- Generated values such as inferred email patterns are labelled and excluded from the entity index. Only observed domains, IPs, emails, URLs, hashes and wallets are collected.
- API keys live in `localStorage` and travel per request through `x-shodan-key`, `x-vt-key`, `x-hibp-key`, `x-hunter-key`, `x-numverify-key` or `x-github-token`. Environment variables take priority when present.
- No database, analytics or server-side retention.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). The framework is detected automatically; no build settings need changing.

Optional environment variables:

```
GITHUB_TOKEN=
SHODAN_API_KEY=
VT_API_KEY=
HIBP_API_KEY=
HUNTER_API_KEY=
NUMVERIFY_API_KEY=
```

Set them in Project Settings → Environment Variables. Users can still bring their own keys from the settings panel.

## Notes

- Registry and feed rate limits vary by egress. Each route has a timeout and a keyless fallback where one exists.
- Username checks are best-effort. Platforms that block datacenter traffic are marked `blocked`, never reported as found.
- Phone carrier data needs Numverify; parsing, region, type and formatting are keyless.
- Domain Contacts only lists emails observed on public pages. The inferred pattern is a candidate, not a verified mailbox.
- `legacy/` holds the original static landing page.
