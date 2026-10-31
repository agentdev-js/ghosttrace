import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./console.css";

export const metadata: Metadata = {
  title: "GhostTrace — OSINT Workstation",
  description:
    "A dense, fast OSINT console. DNS, RDAP, certificate transparency, IP intelligence, username sweeps, breach data, threat intel and dork generation in one interface.",
  applicationName: "GhostTrace",
  authors: [{ name: "agentdev-js", url: "https://github.com/agentdev-js" }],
  keywords: ["osint", "recon", "threat intelligence", "dns", "rdap", "username", "breach"],
};

export const viewport: Viewport = {
  themeColor: "#0a0c0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
