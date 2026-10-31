import { NextRequest, NextResponse } from "next/server";
import { errMessage, getJson, JSON_HEADERS } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

type Chain = "bitcoin" | "ethereum";

function detect(q: string): Chain | null {
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) return "ethereum";
  if (/^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(q)) return "bitcoin";
  return null;
}

interface BlockchairTx {
  hash?: string;
  time?: string;
  value?: number;
  balance_change?: number;
}

interface BlockchairPayload {
  data?: {
    [address: string]: {
      address?: {
        address?: string;
        balance?: number;
        received?: number;
        spent?: number;
        transaction_count?: number;
        type?: string;
        first_seen_receiving?: string;
        last_seen_receiving?: string;
        last_seen_spending?: string;
      };
      transactions?: BlockchairTx[];
    };
  };
}

async function blockchair(chain: Chain, address: string) {
  const host = chain === "bitcoin" ? "bitcoin" : "ethereum";
  const data = await getJson<BlockchairPayload>(
    `https://api.blockchair.com/${host}/dashboards/address/${encodeURIComponent(address)}?limit=10`,
    {},
    14000,
  );
  const entry = data.data?.[address] ?? data.data?.[address.toLowerCase()];
  if (!entry?.address) throw new Error("Empty Blockchair response");
  const a = entry.address;
  const unit = chain === "bitcoin" ? 100000000 : 1e18;
  return {
    chain,
    address: a.address || address,
    balance: (a.balance ?? 0) / unit,
    received: (a.received ?? 0) / unit,
    spent: (a.spent ?? 0) / unit,
    transactions: a.transaction_count ?? 0,
    type: a.type ?? null,
    firstSeen: a.first_seen_receiving ?? null,
    lastSeen: a.last_seen_spending ?? a.last_seen_receiving ?? null,
    recent: (entry.transactions || []).slice(0, 8).map((t) => ({
      hash: t.hash,
      time: t.time,
      value: t.value !== undefined ? t.value / unit : null,
      delta: t.balance_change !== undefined ? t.balance_change / unit : null,
    })),
    explorer:
      chain === "bitcoin"
        ? `https://blockchair.com/bitcoin/address/${address}`
        : `https://blockchair.com/ethereum/address/${address}`,
    source: "Blockchair",
  };
}

async function blockchainInfo(address: string) {
  const data = await getJson<{
    address: string;
    total_received: number;
    total_sent: number;
    final_balance: number;
    n_tx: number;
    first_tx?: { time: number };
    last_tx?: { time: number };
    txs?: { hash: string; time: number; result: number }[];
  }>(`https://blockchain.info/rawaddr/${encodeURIComponent(address)}?limit=8`, {}, 14000);
  return {
    chain: "bitcoin" as const,
    address: data.address,
    balance: data.final_balance / 1e8,
    received: data.total_received / 1e8,
    spent: data.total_sent / 1e8,
    transactions: data.n_tx,
    type: null,
    firstSeen: data.first_tx?.time ? new Date(data.first_tx.time * 1000).toISOString() : null,
    lastSeen: data.last_tx?.time ? new Date(data.last_tx.time * 1000).toISOString() : null,
    recent: (data.txs || []).map((t) => ({ hash: t.hash, time: new Date(t.time * 1000).toISOString(), value: null, delta: t.result / 1e8 })),
    explorer: `https://blockchair.com/bitcoin/address/${address}`,
    source: "Blockchain.com",
  };
}

async function ethplorer(address: string) {
  const data = await getJson<{
    address: string;
    ETH?: { balance?: number; totalIn?: number; totalOut?: number };
    countTxs?: number;
    tokens?: { tokenInfo?: { symbol?: string; name?: string; decimals?: string }; balance?: number }[];
  }>(`https://api.ethplorer.io/getAddressInfo/${encodeURIComponent(address)}?apiKey=freekey`, {}, 14000);
  const tokens = (data.tokens || [])
    .filter((t) => t.tokenInfo?.symbol)
    .slice(0, 12)
    .map((t) => ({
      symbol: t.tokenInfo?.symbol,
      name: t.tokenInfo?.name,
      balance: t.tokenInfo?.decimals ? (t.balance || 0) / Math.pow(10, Number(t.tokenInfo.decimals)) : t.balance,
    }));
  return {
    chain: "ethereum" as const,
    address: data.address || address,
    balance: data.ETH?.balance ?? 0,
    received: data.ETH?.totalIn ?? null,
    spent: data.ETH?.totalOut ?? null,
    transactions: data.countTxs ?? 0,
    type: null,
    firstSeen: null,
    lastSeen: null,
    recent: [],
    tokens,
    explorer: `https://etherscan.io/address/${address}`,
    source: "Ethplorer",
  };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400, headers: JSON_HEADERS });

  const chain = detect(q);
  if (!chain) return NextResponse.json({ error: "Not a recognised BTC or ETH address" }, { status: 400, headers: JSON_HEADERS });

  try {
    if (chain === "bitcoin") {
      try {
        return NextResponse.json(await blockchair("bitcoin", q), { headers: JSON_HEADERS });
      } catch {
        return NextResponse.json(await blockchainInfo(q), { headers: JSON_HEADERS });
      }
    }

    try {
      const result = await blockchair("ethereum", q);
      return NextResponse.json(result, { headers: JSON_HEADERS });
    } catch {
      const result = await ethplorer(q);
      return NextResponse.json(result, { headers: JSON_HEADERS });
    }
  } catch (e) {
    return NextResponse.json({ error: errMessage(e), target: q, chain }, { status: 502, headers: JSON_HEADERS });
  }
}
