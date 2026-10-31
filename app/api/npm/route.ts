import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface NpmPackage {
  name: string;
  description?: string;
  "dist-tags"?: { latest?: string };
  license?: string;
  homepage?: string;
  repository?: { url?: string; type?: string };
  maintainers?: { name?: string; email?: string }[];
  author?: { name?: string; email?: string } | string;
  keywords?: string[];
  readme?: string;
  time?: Record<string, string>;
  versions?: Record<string, unknown>;
  bugs?: { url?: string };
}

interface NpmDownloads {
  downloads?: number;
  start?: string;
  end?: string;
}

interface NpmSearch {
  objects?: {
    package?: {
      name: string;
      version: string;
      description?: string;
      date?: string;
      links?: { npm?: string; homepage?: string; repository?: string };
      publisher?: { username?: string; email?: string };
    };
  }[];
  total?: number;
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!raw) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const name = raw.replace(/^@/, "@").replace(/^npm\s+/, "").trim();

  try {
    const pkg = await getJson<NpmPackage>(`https://registry.npmjs.org/${encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/")}`, {}, 12000);
    const latest = pkg["dist-tags"]?.latest;
    let downloads: NpmDownloads | null = null;
    try {
      downloads = await getJson<NpmDownloads>(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`, {}, 9000);
    } catch {
      downloads = null;
    }

    const repoUrl = typeof pkg.repository === "object" ? pkg.repository?.url : undefined;
    const versions = pkg.versions ? Object.keys(pkg.versions) : [];
    const author = typeof pkg.author === "string" ? { name: pkg.author } : pkg.author;

    return NextResponse.json(
      {
        target: name,
        found: true,
        package: {
          name: pkg.name,
          description: pkg.description,
          latest,
          license: pkg.license,
          homepage: pkg.homepage,
          repository: repoUrl?.replace(/^git\+/, "").replace(/\.git$/, ""),
          bugs: pkg.bugs?.url,
          keywords: pkg.keywords?.slice(0, 15) || [],
          maintainers: (pkg.maintainers || []).slice(0, 10),
          author,
        },
        versions: {
          count: versions.length,
          latest,
          created: pkg.time?.created,
          modified: pkg.time?.modified,
          recent: versions.slice(-10),
        },
        downloads: downloads ? { lastMonth: downloads.downloads, start: downloads.start, end: downloads.end } : null,
        source: `https://www.npmjs.com/package/${name}`,
      },
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    const msg = errMessage(e);
    if (msg.startsWith("404")) {
      try {
        const search = await getJson<NpmSearch>(
          `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(name)}&size=12`,
          {},
          12000,
        );
        return NextResponse.json(
          {
            target: name,
            found: false,
            matches: (search.objects || []).map((o) => ({
              name: o.package?.name,
              version: o.package?.version,
              description: o.package?.description,
              date: o.package?.date,
              publisher: o.package?.publisher?.username,
              npm: o.package?.links?.npm,
            })),
            total: search.total ?? 0,
            source: `https://www.npmjs.com/search?q=${encodeURIComponent(name)}`,
          },
          { headers: JSON_HEADERS },
        );
      } catch (inner) {
        return NextResponse.json({ error: errMessage(inner), target: name }, { status: 502, headers: JSON_HEADERS });
      }
    }
    return NextResponse.json({ error: msg, target: name }, { status: 502, headers: JSON_HEADERS });
  }
}
