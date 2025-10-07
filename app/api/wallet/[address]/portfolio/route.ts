export const runtime = 'nodejs';
import { NextResponse } from "next/server";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeout = 10000, retries = 1) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        if (res.ok) return res;
        if (res.status >= 500 && attempt < retries)
          await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
      } catch (err) {
        if (attempt < retries) continue;
        throw err;
      }
    }
  } finally {
    clearTimeout(id);
  }
  throw new Error("fetch failed");
}

async function getEthPriceUSD() {
  try {
    const res = await fetchWithTimeout(`${COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=usd`);
    const j = await res.json();
    return j?.ethereum?.usd ?? 0;
  } catch {
    return 0;
  }
}

async function getPriceByContract(contractAddress: string): Promise<number> {
  try {
    const addr = encodeURIComponent(contractAddress.toLowerCase());
    const res = await fetchWithTimeout(
      `${COINGECKO_API}/simple/token_price/ethereum?contract_addresses=${addr}&vs_currencies=usd`
    );
    const j = await res.json();
    const k = Object.keys(j)[0];
    return k ? j[k].usd ?? 0 : 0;
  } catch {
    return 0;
  }
}

const cache = new Map<string, { ts: number; price: number }>();
const TTL = 1000 * 60 * 2;

export async function GET(_req: Request, ctx: any) {
  const params = await ctx.params;
  const address = String(params?.address || "").toLowerCase();

  const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
  const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK ?? "mainnet";
  if (!ALCHEMY_KEY)
    return NextResponse.json({ error: "Missing ALCHEMY_API_KEY" }, { status: 500 });

  const ALCHEMY_BASE = `https://eth-${ALCHEMY_NETWORK}.g.alchemy.com/v2/${ALCHEMY_KEY}`;

  try {
    // token balances
    const res = await fetchWithTimeout(ALCHEMY_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [address, "erc20"],
      }),
    });
    const data = await res.json();
    const tokens = data?.result?.tokenBalances || [];

    // ETH balance
    const ethRes = await fetchWithTimeout(ALCHEMY_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });
    const ethJson = await ethRes.json();
    const ethBalance = Number(BigInt(ethJson.result ?? "0x0")) / 1e18;
    const ethPrice = await getEthPriceUSD();

    const metaPromises = tokens.slice(0, 15).map(async (t: any) => {
      try {
        const meta = await fetchWithTimeout(ALCHEMY_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "alchemy_getTokenMetadata",
            params: [t.contractAddress],
          }),
        }).then((r) => r.json());
        const m = meta?.result ?? {};
        const raw = t.tokenBalance ?? "0x0";
        const bal = Number(BigInt(raw)) / 10 ** (m.decimals ?? 18);
        const cached = cache.get(t.contractAddress);
        let price = cached?.price ?? 0;
        if (!cached || Date.now() - cached.ts > TTL) {
          price = await getPriceByContract(t.contractAddress);
          cache.set(t.contractAddress, { ts: Date.now(), price });
        }
        return {
          contract: t.contractAddress,
          symbol: m.symbol ?? "UNK",
          name: m.name ?? "Unknown",
          balance: bal,
          usd: bal * price,
        };
      } catch {
        return { contract: t.contractAddress, symbol: "UNK", name: "Unknown", balance: 0, usd: 0 };
      }
    });

    const tokensMeta = await Promise.all(metaPromises);
    const assets = [
      { symbol: "ETH", name: "Ethereum", balance: ethBalance, usd: ethBalance * ethPrice },
      ...tokensMeta.filter((a) => a.balance > 0),
    ];
    const totalUsd = assets.reduce((s, a) => s + (a.usd ?? 0), 0);

    return NextResponse.json({ address, totalUsd, assets, source: "alchemy+coingecko" });
  } catch (err: any) {
    console.error("portfolio route error", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

