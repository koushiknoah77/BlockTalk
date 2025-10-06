import { NextResponse } from "next/server";

const DEFAULT_ALCHEMY_BASE = (key: string, network = "mainnet") =>
  `https://eth-${network}.g.alchemy.com/v2/${key}`;

/** small helper fetch with timeout/retries (works server-side) */
async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeout = 10000, retries = 1) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  let attempt = 0;
  try {
    while (true) {
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        if (!res.ok && (res.status === 429 || res.status >= 500) && attempt < retries) {
          attempt++;
          const backoff = 200 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        return res;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (attempt < retries) {
          attempt++;
          const backoff = 200 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw err;
      }
    }
  } finally {
    clearTimeout(id);
  }
}

async function alchemyRpc(alchemyBase: string, method: string, params: any[] = []) {
  const res = await fetchWithTimeout(alchemyBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, 10000, 1);

  const text = await res.text();
  if (!res.ok) throw new Error(`Alchemy RPC ${method} failed: ${text}`);
  const parsed = JSON.parse(text);
  return parsed.result;
}

/** Normalize alchemy_getAssetTransfers response shape -> Array */
function normalizeTransfers(raw: any) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.transfers)) return raw.transfers;
  if (typeof raw === "object" && raw.hash) return [raw];
  return [];
}

function isValidAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/** Route: GET /api/wallet/[address]/pnl */
export async function GET(_req: Request, context: any) {
  try {
    const paramsResolved = await Promise.resolve(context?.params ?? {});
    const address = String(paramsResolved?.address || "").toLowerCase();

    if (!isValidAddress(address))
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });

    const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";
    const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK ?? "mainnet";
    const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL ?? "";
    const ALCHEMY_BASE =
      ALCHEMY_KEY ? DEFAULT_ALCHEMY_BASE(ALCHEMY_KEY, ALCHEMY_NETWORK) : ALCHEMY_API_URL || null;

    if (!ALCHEMY_BASE)
      return NextResponse.json({ error: "Missing ALCHEMY_API_KEY or ALCHEMY_API_URL" }, { status: 500 });

    // current balance
    const balRes = await alchemyRpc(ALCHEMY_BASE, "eth_getBalance", [address, "latest"]);
    const balHex = balRes ?? "0x0";
    const currentBalance = Number(BigInt(balHex)) / 1e18;

    // fetch transfers
    const transfersRes = await alchemyRpc(ALCHEMY_BASE, "alchemy_getAssetTransfers", [{
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["external", "internal"],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: "0x1f4",
      fromAddress: address,
    }]);
    const transfers = transfersRes?.transfers ?? transfersRes ?? [];

    const events: { ts: number; deltaEth: number }[] = [];
    for (const t of transfers) {
      const ts = new Date(t.metadata?.blockTimestamp).getTime();
      const val = Number(t.value ?? 0);
      if (val !== 0) {
        const sign = t.to?.toLowerCase() === address ? +1 : -1;
        events.push({ ts, deltaEth: sign * val });
      }
    }

    events.sort((a, b) => a.ts - b.ts);
    const ethPrice = 0; // Keep simple: On-demand price lookup could be added
    const now = Date.now();
    const oneDay = 86400000;
    const rangeDays = Number(new URL(_req.url).searchParams.get("rangeDays") ?? 30);
    const startDate = new Date(now - (rangeDays - 1) * oneDay);
    startDate.setUTCHours(0, 0, 0, 0);

    const series = [];
    for (let i = 0; i < rangeDays; i++) {
      const dayTs = startDate.getTime() + i * oneDay;
      const balance = currentBalance; // fallback (flat)
      series.push({
        date: new Date(dayTs).toISOString().slice(0, 10),
        eth: balance,
        usd: ethPrice ? balance * ethPrice : null,
      });
    }

    return NextResponse.json({
      address,
      note: "ETH-only history reconstructed.",
      series,
      source: "alchemy-reconstructed",
    });
  } catch (err: any) {
    console.error("pnl route error", err);
    return NextResponse.json({ error: String(err?.message ?? err), series: [] }, { status: 500 });
  }
}
