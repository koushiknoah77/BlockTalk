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

/** fetch tx.value if missing */
async function fetchTxValueIfMissing(alchemyBase: string, t: any) {
  try {
    if (!t || !t.hash) return null;
    if (t.value && String(t.value) !== "0") return t.value;
    const txRaw = await alchemyRpc(alchemyBase, "eth_getTransactionByHash", [t.hash]);
    const vHex = txRaw?.value ?? txRaw?.result?.value;
    if (!vHex) return null;
    const val = Number(BigInt(vHex)) / 1e18;
    return val.toFixed(6);
  } catch {
    return null;
  }
}

/** Core: fetch asset transfers (incoming + outgoing) */
async function getAssetTransfers(alchemyBase: string, address: string, maxCount = 50) {
  const baseReq = {
    fromBlock: "0x0",
    toBlock: "latest",
    category: ["external", "internal", "erc20", "erc721", "erc1155"],
    maxCount: `0x${maxCount.toString(16)}`,
    withMetadata: true,
    excludeZeroValue: false,
  };

  const outParams = [{ ...baseReq, fromAddress: address }];
  const inParams = [{ ...baseReq, toAddress: address }];
  const [outRaw, inRaw] = await Promise.allSettled([
    alchemyRpc(alchemyBase, "alchemy_getAssetTransfers", outParams),
    alchemyRpc(alchemyBase, "alchemy_getAssetTransfers", inParams),
  ]);

  const outs = normalizeTransfers(outRaw.status === "fulfilled" ? outRaw.value : []);
  const ins = normalizeTransfers(inRaw.status === "fulfilled" ? inRaw.value : []);
  const merged = [...outs, ...ins];

  const byHash = new Map<string, any>();
  for (const t of merged) {
    if (!t?.hash) continue;
    const prev = byHash.get(t.hash);
    if (!prev) { byHash.set(t.hash, t); continue; }
    const pTs = new Date(prev.metadata?.blockTimestamp || 0).getTime();
    const tTs = new Date(t.metadata?.blockTimestamp || 0).getTime();
    if (tTs > pTs) byHash.set(t.hash, t);
  }

  const arr = Array.from(byHash.values());
  arr.sort((a, b) =>
    new Date(b.metadata?.blockTimestamp || 0).getTime() -
    new Date(a.metadata?.blockTimestamp || 0).getTime()
  );
  return arr.slice(0, maxCount);
}

function isValidAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/** Route: GET /api/wallet/[address]/txs */
export async function GET(_req: Request, context: { params?: any }) {
  try {
    const params = await (context.params ?? {});
    const addressRaw = (params.address || "").toLowerCase();

    if (!isValidAddress(addressRaw))
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });

    const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";
    const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK ?? "mainnet";
    const ALCHEMY_API_URL = process.env.ALCHEMY_API_URL ?? "";
    const ALCHEMY_BASE =
      ALCHEMY_KEY ? DEFAULT_ALCHEMY_BASE(ALCHEMY_KEY, ALCHEMY_NETWORK) : ALCHEMY_API_URL || null;

    if (!ALCHEMY_BASE)
      return NextResponse.json({ error: "Missing ALCHEMY_API_KEY or ALCHEMY_API_URL" }, { status: 500 });

    const url = new URL(_req.url);
    const maxCount = Number(url.searchParams.get("maxCount") ?? 50);

    const transfers = await getAssetTransfers(ALCHEMY_BASE, addressRaw, Math.min(500, Math.max(10, maxCount)));

    const txs = await Promise.all(
      transfers.map(async (t) => ({
        hash: t.hash,
        category: t.category,
        from: t.from,
        to: t.to,
        value:
          t.value ??
          (t.erc20Token?.tokenSymbol
            ? `${t.erc20Token.tokenSymbol} ${t.erc20Token.value}`
            : await fetchTxValueIfMissing(ALCHEMY_BASE, t)),
        metadata: t.metadata ?? null,
        asset: t.asset ?? null,
      }))
    );

    return NextResponse.json({ address: addressRaw, txs, source: "alchemy" });
  } catch (err: any) {
    console.error("txs route error", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
