// app/api/dao/[address]/votes/route.ts
export const runtime = "nodejs";

const SNAPSHOT_API = "https://hub.snapshot.org/graphql";

const QUERY = `
  query Proposals($spaces: [String!]) {
    proposals(
      first: 20,
      where: { space_in: $spaces, state: "active" },
      orderBy: "end",
      orderDirection: asc
    ) {
      id
      title
      body
      end
      start
      space {
        id
        name
      }
      link
    }
  }
`;

/** small fetch wrapper with timeout to avoid hanging requests */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8000,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, {
      ...(init ?? {}),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** fetch active proposals for a list of snapshot spaces */
async function snapshotFetch(spaces: string[]) {
  const res = await fetchWithTimeout(
    SNAPSHOT_API,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { spaces } }),
    },
    10_000,
  ); // 10s timeout for snapshot

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Snapshot fetch failed: ${res.status} ${txt}`);
  }

  const json = await res.json().catch(() => ({}));
  return json?.data?.proposals ?? [];
}

/** validate simple ethereum address */
function isEthAddress(addr?: string) {
  if (!addr || typeof addr !== "string") return false;
  return /^0x[a-f0-9]{40}$/i.test(addr.trim());
}

/**
 * GET handler
 *
 * NOTE: per Next.js app-router types, `context.params` may be a Promise.
 * We accept the typed context and `await` params to satisfy TS expectations.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ address: string }> },
) {
  console.log("✅ DAO votes route triggered", new Date().toISOString());

  try {
    // Await params (TypeScript / Next expects this shape in app-router codegen)
    const params = await context.params;
    const addressRaw = String(params?.address ?? "").trim();
    const address = addressRaw.toLowerCase();

    if (!isEthAddress(address)) {
      return new Response(JSON.stringify({ error: "Invalid address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Predefined major DAO spaces to query on Snapshot
    const spaces = [
      "uniswap",
      "aave.eth",
      "ens.eth",
      "arbitrumfoundation.eth",
      "compound.eth",
      "balancer.eth",
      "optimism.eth",
    ];

    // Fetch proposals from Snapshot
    const proposals = await snapshotFetch(spaces);

    // Filter and format "open" proposals (end timestamp is in seconds)
    const nowSeconds = Date.now() / 1000;
    const open = (proposals || [])
      .filter((p: any) => {
        const endNum = Number(p?.end ?? 0);
        return !Number.isNaN(endNum) && endNum > nowSeconds;
      })
      .slice(0, 20) // safety clamp
      .map((p: any) => ({
        title: p.title,
        dao: p.space?.name ?? p.space?.id ?? null,
        link:
          p.link ?? `https://snapshot.org/#/${p.space?.id}/proposal/${p.id}`,
        ends: new Date(Number(p.end) * 1000).toISOString(),
      }));

    const out = { address, open, count: open.length, source: "snapshot.org" };

    return new Response(JSON.stringify(out, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("DAO votes route error", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
