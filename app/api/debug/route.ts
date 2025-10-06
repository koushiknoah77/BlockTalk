export const runtime = 'nodejs';

const DEFAULT_ALCHEMY_BASE = (key: string, network = 'mainnet') =>
  `https://eth-${network}.g.alchemy.com/v2/${key}`;

async function alchemyRpcRaw(alchemyBase: string, method: string, params: any[] = []) {
  const res = await fetch(alchemyBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { ok: res.ok, status: res.status, body: parsed };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const hash = url.searchParams.get('hash');
    if (!hash) {
      return new Response(JSON.stringify({ error: 'Missing ?hash= parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
    const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK || 'mainnet';
    if (!ALCHEMY_KEY) {
      return new Response(JSON.stringify({ error: 'Missing ALCHEMY_API_KEY in .env.local' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const base = DEFAULT_ALCHEMY_BASE(ALCHEMY_KEY, ALCHEMY_NETWORK);

    const tx = await alchemyRpcRaw(base, 'eth_getTransactionByHash', [hash]);
    const receipt = await alchemyRpcRaw(base, 'eth_getTransactionReceipt', [hash]);

    return new Response(JSON.stringify({ hash, network: ALCHEMY_NETWORK, tx, receipt }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('debug route error', err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
