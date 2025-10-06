// app/api/ai/route.ts
export const runtime = "nodejs";

type ReqBody = { address?: string; query?: string; rangeDays?: number };

const DEFAULT_ALCHEMY_BASE = (key: string, network = "mainnet") =>
  `https://eth-${network.trim()}.g.alchemy.com/v2/${key}`;

/* ---------------------- Small helpers & safe fetch ---------------------- */

/** Validate simple Ethereum address (0x + 40 hex chars) */
function isEthAddress(addr?: string) {
  if (!addr || typeof addr !== "string") return false;
  return /^0x[a-f0-9]{40}$/i.test(addr.trim());
}

/** fetch wrapper with timeout */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 10000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...(init ?? {}), signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** BigInt-safe helpers */
function hexToBigIntSafe(hex: any) {
  try {
    if (!hex && hex !== 0 && hex !== "0x0") return 0n;
    // If already bigint
    if (typeof hex === "bigint") return hex;
    // If numeric string
    if (typeof hex === "number") return BigInt(Math.trunc(hex));
    if (typeof hex === "string") {
      const s = hex.toString();
      // decimal string?
      if (/^\d+$/.test(s)) return BigInt(s);
      // hex?
      if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
      // fallback
      return BigInt(Number(s) || 0);
    }
    return BigInt(0);
  } catch {
    return BigInt(0);
  }
}
function fmtEthFromWeiBigInt(wei: bigint) {
  // convert to Number; handle extremely large numbers by clamping
  try {
    const n = Number(wei);
    if (!Number.isFinite(n)) {
      // fallback division via bigint -> string if needed
      const s = wei.toString();
      const asNumber = Number(s) / 1e18;
      return asNumber;
    }
    return n / 1e18;
  } catch {
    return 0;
  }
}

/* ---------------------- Alchemy RPC helpers (with timeout) ---------------------- */

async function alchemyRpc(alchemyBase: string, method: string, params: any[] = []) {
  const res = await fetchWithTimeout(
    alchemyBase,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    10000
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Alchemy RPC ${method} failed: ${text}`);
  return JSON.parse(text).result;
}

async function alchemyRpcRaw(alchemyBase: string, method: string, params: any[] = []) {
  const res = await fetchWithTimeout(
    alchemyBase,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    10000
  );
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

/* ---------------------- Get Transfers ---------------------- */

/**
 * getAssetTransfers
 * - clamps maxCount to avoid huge responses
 * - returns merged (in+out) transfers
 */
async function getAssetTransfers(alchemyBase: string, address: string, maxCount = 50) {
  if (!address) return [];
  const clampMax = Math.min(Math.max(1, maxCount), 200); // clamp 1..200
  const baseReq = {
    fromBlock: "0x0", // keep genesis by default but limit number of results with maxCount
    toBlock: "latest",
    category: ["external", "internal", "erc20", "erc721", "erc1155"],
    maxCount: `0x${clampMax.toString(16)}`,
    withMetadata: true,
    excludeZeroValue: false,
  };

  const [outRes, inRes] = await Promise.allSettled([
    alchemyRpc(alchemyBase, "alchemy_getAssetTransfers", [{ ...baseReq, fromAddress: address }]),
    alchemyRpc(alchemyBase, "alchemy_getAssetTransfers", [{ ...baseReq, toAddress: address }]),
  ]);

  const normalize = (v: any) =>
    Array.isArray(v) ? v : Array.isArray(v?.transfers) ? v.transfers : v?.hash ? [v] : [];

  const outs = outRes.status === "fulfilled" ? normalize(outRes.value) : [];
  const ins = inRes.status === "fulfilled" ? normalize(inRes.value) : [];
  const merged = [...outs, ...ins];

  // dedupe by tx hash, prefer latest timestamp
  const byHash = new Map<string, any>();
  for (const t of merged) {
    if (!t?.hash) continue;
    const prev = byHash.get(t.hash);
    if (!prev) byHash.set(t.hash, t);
    else {
      const pTs = new Date(prev.metadata?.blockTimestamp || 0).getTime();
      const tTs = new Date(t.metadata?.blockTimestamp || 0).getTime();
      if (tTs > pTs) byHash.set(t.hash, t);
    }
  }

  const arr = Array.from(byHash.values());
  arr.sort(
    (a, b) =>
      new Date(b.metadata?.blockTimestamp || 0).getTime() -
      new Date(a.metadata?.blockTimestamp || 0).getTime()
  );
  return arr.slice(0, clampMax);
}

async function getTxAndReceipt(alchemyBase: string, txHash: string) {
  const tx = await alchemyRpcRaw(alchemyBase, "eth_getTransactionByHash", [txHash]);
  const receipt = await alchemyRpcRaw(alchemyBase, "eth_getTransactionReceipt", [txHash]);
  return { tx, receipt };
}

/* ---------------------- CoinGecko (retry + cache) ---------------------- */

const priceCache = { eth: { usd: 0, ts: 0 } };

async function coinGeckoEthPrice() {
  const now = Date.now();
  // longer cache TTL (5 minutes)
  if (priceCache.eth.usd && now - priceCache.eth.ts < 5 * 60 * 1000) return priceCache.eth.usd;

  const urls = [
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    "https://coins.llama.fi/prices/current/coingecko:ethereum",
  ];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, {}, 8000);
      if (!res.ok) continue;
      const json = await res.json();
      let price = 0;
      if (json?.ethereum?.usd) price = json.ethereum.usd;
      else if (json?.coins?.["coingecko:ethereum"]?.price)
        price = json.coins["coingecko:ethereum"].price;
      if (price) {
        priceCache.eth = { usd: price, ts: now };
        return price;
      }
    } catch {
      // small sleep on failure
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return priceCache.eth.usd || 0;
}

/* ---------------------- Parse token/ETH values for transfers (robust) ---------------------- */

function parseTransferSafely(t: any) {
  const ts = new Date(t.metadata?.blockTimestamp || 0);
  const dateStr = ts.toLocaleString("en-GB");
  const hash = t.hash;
  const explorer = `https://etherscan.io/tx/${hash}`;

  const symbol = t.asset || t.erc20Token?.tokenSymbol || "ETH";
  let amount = 0;

  // native ETH value in 'value' (may be hex or decimal string)
  if (t.value) {
    try {
      const bi = hexToBigIntSafe(t.value);
      if (bi > 0n) amount = Number(bi) / 1e18;
    } catch {}
  }

  // ERC-20: prefer erc20Token.value/rawValue and tokenDecimals
  if ((t.erc20Token?.value || t.erc20Token?.rawValue) && t.erc20Token?.tokenDecimals !== undefined) {
    const raw = t.erc20Token?.value ?? t.erc20Token?.rawValue;
    try {
      const bi = hexToBigIntSafe(raw);
      const dec = Number(t.erc20Token.tokenDecimals) || 0;
      if (dec >= 0) amount = Number(bi) / 10 ** dec;
    } catch {
      const maybeNum = Number(raw);
      if (!isNaN(maybeNum)) amount = maybeNum;
    }
  }

  // fallback: some providers supply amount or numeric field
  if ((amount === 0 || amount === 0.0) && t.amount && !isNaN(Number(t.amount))) {
    amount = Number(t.amount);
  }

  return { hash, date: dateStr, amount, symbol, explorer };
}

/* ---------------------- Stream helpers ---------------------- */

const encoder = new TextEncoder();
function enqueue(controller: ReadableStreamDefaultController, text: string) {
  controller.enqueue(encoder.encode(text));
}
function streamChunk(controller: ReadableStreamDefaultController, text: string) {
  enqueue(controller, `data: ${text}\n\n`);
}
function streamStructured(controller: ReadableStreamDefaultController, text: string, obj: any) {
  streamChunk(controller, text);
  streamChunk(controller, `[STRUCTURED]${JSON.stringify(obj)}`);
  streamChunk(controller, `[DONE]`);
  try {
    controller.close();
  } catch {}
}

/* ---------------------- Main Route ---------------------- */

export async function POST(req: Request) {
  try {
    const body: ReqBody = await req.json();

    // validate & normalize
    const addressRaw = (body.address ?? "").toString().trim();
    const address = addressRaw ? addressRaw.toLowerCase() : "";
    const query = (body.query || "").trim().slice(0, 1024); // limit length
    const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
    const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK || "mainnet";
    const CUSTOM_ALCHEMY_BASE = (process.env.ALCHEMY_BASE_URL || "").trim() || null;
    const ALCHEMY_BASE = CUSTOM_ALCHEMY_BASE ?? (ALCHEMY_KEY ? DEFAULT_ALCHEMY_BASE(ALCHEMY_KEY, ALCHEMY_NETWORK) : null);

    if (!ALCHEMY_BASE) {
      return new Response(JSON.stringify({ error: "Missing ALCHEMY_API_KEY or ALCHEMY_BASE_URL" }), {
        status: 500,
      });
    }

    const q = query.toLowerCase();
    const isTx = /0x[a-f0-9]{64}/i.test(q);
    const isGas = /gas/i.test(q);
    const isPnl = /pnl|portfolio|net worth/i.test(q);
    const isActivity = /recent|activity|transactions/i.test(q);
    const isDao = /dao|proposal|vote|votes due|governance/i.test(q);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let text = "";
          let structured: any = {};

          // If the intent requires a wallet address and it's missing, return structured message
          const needsAddress = isGas || isPnl || isActivity || isDao;
          if (needsAddress && !isEthAddress(address)) {
            return streamStructured(
              controller,
              "Missing or invalid wallet address. Connect wallet and provide a valid 0x... address.",
              { error: "missing_address" }
            );
          }

          /* ------------------ TX HASH block ------------------ */
          if (isTx) {
            const hash = (q.match(/0x[a-f0-9]{64}/i) || [])[0];
            if (!hash) {
              return streamStructured(controller, `Transaction hash not found in query.`, {});
            }

            const { tx, receipt } = await getTxAndReceipt(ALCHEMY_BASE, hash);
            const txRes = tx?.body?.result;
            const rRes = receipt?.body?.result;
            if (!txRes && !rRes) return streamStructured(controller, `Transaction ${hash} not found.`, {});

            const gasUsed = hexToBigIntSafe(rRes?.gasUsed ?? "0x0");
            const gasPrice = hexToBigIntSafe(rRes?.effectiveGasPrice ?? txRes?.gasPrice ?? "0x0");
            const feeEth = fmtEthFromWeiBigInt(gasUsed * gasPrice);
            const ethUsd = await coinGeckoEthPrice();
            const feeUsd = feeEth * ethUsd;
            const status = rRes?.status === "0x1" || rRes?.status === 1 ? "✅ success" : "❌ failed";
            text = `Tx ${hash.slice(0, 10)}… ${status}. Gas fee: ${feeEth.toFixed(6)} ETH (~$${feeUsd.toFixed(
              2
            )}).`;
            return streamStructured(controller, text, { answer: text, tx: txRes, receipt: rRes });
          }

          /* ------------------ GAS estimation (sample) ------------------ */
          if (isGas) {
            // Fetch a bounded sample of transfers then fetch receipts (limited) to estimate gas
            const transfers = await getAssetTransfers(ALCHEMY_BASE, address, 200);
            const sample = transfers.slice(0, 20);
            let totalWei = 0n;
            let count = 0n;

            // parallel but bounded (20 items is OK); keep small concurrency by micro-batching
            const batchSize = 6;
            for (let i = 0; i < sample.length; i += batchSize) {
              const batch = sample.slice(i, i + batchSize);
              const results = await Promise.all(
                batch.map(async (t: any) => {
                  try {
                    return await getTxAndReceipt(ALCHEMY_BASE, t.hash);
                  } catch {
                    return null;
                  }
                })
              );
              for (const rpack of results) {
                if (!rpack) continue;
                const r = rpack.receipt?.body?.result;
                const x = rpack.tx?.body?.result;
                const used = hexToBigIntSafe(r?.gasUsed ?? "0x0");
                const price = hexToBigIntSafe(r?.effectiveGasPrice ?? x?.gasPrice ?? "0x0");
                if (used > 0n && price > 0n) {
                  totalWei += used * price;
                  count++;
                }
              }
            }

            const totalEth = fmtEthFromWeiBigInt(totalWei);
            const usd = totalEth * (await coinGeckoEthPrice());
            text = `Estimated gas used in ${count} txs: ${totalEth.toFixed(6)} ETH (~$${usd.toFixed(2)}).`;
            return streamStructured(controller, text, { answer: text, approxCount: Number(count), totalGasEth: totalEth, usd });
          }

          /* ------------------ PORTFOLIO (simple ETH-only) ------------------ */
          if (isPnl) {
            // eth_getBalance expects proper address
            const balHex = await alchemyRpc(ALCHEMY_BASE, "eth_getBalance", [address, "latest"]);
            const balance = Number(hexToBigIntSafe(balHex)) / 1e18;
            const usd = balance * (await coinGeckoEthPrice());
            text = `Wallet balance: ${balance.toFixed(6)} ETH (~$${usd.toFixed(2)}).`;
            return streamStructured(controller, text, { answer: text, balance, usd });
          }

          /* ------------------ RECENT ACTIVITY ------------------ */
          if (isActivity) {
            const transfers = await getAssetTransfers(ALCHEMY_BASE, address, 50);
            const parsed = transfers
              .map(parseTransferSafely)
              .filter((t) => t.amount > 0)
              .slice(0, 10);

            const ethUsd = await coinGeckoEthPrice();
            const lines = parsed
              .map((t) => `• ${t.hash.slice(0, 10)}…  ${t.amount.toFixed(6)} ${t.symbol}  (${t.date})`)
              .join("\n");

            text = parsed.length > 0 ? `Here are your ${parsed.length} most recent transfers:\n${lines}` : "No recent non-zero transfers found.";
            structured = { answer: text, items: parsed.slice(0, 25), source: "alchemy", priceEth: ethUsd };
            return streamStructured(controller, text, structured);
          }

          /* ------------------ DAO proposals (delegated) ------------------ */
          if (isDao) {
            const baseUrl =
              process.env.NEXT_PUBLIC_BASE_URL ??
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
            try {
              const res = await fetchWithTimeout(`${baseUrl}/api/dao/${address}/votes`, {}, 8000);
              if (!res.ok) {
                return streamStructured(controller, "Failed to fetch DAO proposals.", { error: "dao_fetch_failed", status: res.status });
              }
              const data = await res.json();
              if (!data?.open?.length) return streamStructured(controller, "No active DAO proposals found.", {});
              const lines = data.open
                .slice(0, 5)
                .map((p: any) => `• ${p.dao}: ${p.title} (ends ${new Date(p.ends).toLocaleDateString()})`)
                .join("\n");
              text = `Here are ${data.open.length} open DAO proposals you can review:\n${lines}`;
              return streamStructured(controller, text, { answer: text, proposals: data.open.slice(0, 25) });
            } catch (err: any) {
              return streamStructured(controller, "Failed to fetch DAO proposals (network error).", { error: String(err?.message ?? err) });
            }
          }

          /* ------------------ FALLBACK ------------------ */
          return streamStructured(
            controller,
            `I couldn't classify your query. Try "gas spent", "portfolio PnL", or "recent transactions".`,
            {}
          );
        } catch (err: any) {
          const msg = `AI route stream error: ${String(err?.message ?? err)}`;
          streamChunk(controller, msg);
          streamChunk(controller, `[STRUCTURED]${JSON.stringify({ error: msg })}`);
          streamChunk(controller, `[DONE]`);
          try {
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
    });
  }
}
