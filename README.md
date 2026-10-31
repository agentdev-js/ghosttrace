# GhostTrace

An OSINT workstation that looks and feels like a desktop chat client. Drop a target, fan it out across every compatible source, and read the findings in a single streaming feed.

Live at [ghosttrace.vercel.app](https://ghosttrace.vercel.app) once deployed.

## What it does

| Module | Accepts | Source | Key |
| --- | --- | --- | --- |
| DNS Recon | domain | Cloudflare DoH | no |
| WHOIS / RDAP | domain, ip | rdap.org | no |
| IP Intelligence | ip, domain | ipwho.is | no |
| Certificate Transparency | domain | crt.sh | no |
| Wayback Machine | domain, url | archive.org CDX | no |
| URLScan.io | domain, url, ip | urlscan.io | no |
| Dork Forge | any | generated | no |
| Username Sweep | username | 30 platforms | no |
| GitHub Recon | username | GitHub API | optional |
| Email Intelligence | email | DNS, Gravatar | no |
| Phone Intelligence | phone | libphonenumber | optional |
| Crypto Address | btc, eth | Blockchair, Ethplorer | no |
| CVE Lookup | cve | NVD | no |
| Shodan Host | ip, domain | Shodan | yes |
| VirusTotal | ip, domain, hash, url | VirusTotal | yes |
| Breach Check | email | HIBP | yes |
| Hunter.io | domain | Hunter | yes |
| MAC Vendor | mac | maclookup.app | no |
| npm Package | package, username | npm registry | no |

Keyless modules work immediately. Keyed modules show a clear prompt and a Settings shortcut until a key is supplied.

## Architecture

- Next.js 15 App Router, React 19, TypeScript, Tailwind v4.
- Every third-party call lives in a serverless route under `app/api/*`. The browser never talks to an upstream source directly, which sidesteps CORS and keeps the target surface small.
- The client is a single workstation view: rail, module list, target console, streaming result feed, and an entity pivot panel.
- API keys are stored in `localStorage` and attached to a request through `x-shodan-key`, `x-vt-key`, `x-hibp-key`, `x-hunter-key`, `x-numverify-key`, or `x-github-token`. Server environment variables take priority when present.
- No database, no analytics, no server-side persistence.

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

Set them in Project Settings → Environment Variables. Users can still bring their own keys in the UI.

## Notes

- crt.sh and urlscan.io rate-limit from serverless egress. The UI surfaces upstream errors instead of hiding them.
- Username checks are best-effort by nature. Platforms that block datacenter traffic return `blocked`, never a false positive.
- Function durations are capped in each route so a slow upstream cannot hold a request open.
- `legacy/` holds the original static landing page.
