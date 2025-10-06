'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAccount } from 'wagmi';

type Range = 7 | 30 | 90;
const STORAGE_KEY = 'blocktalk.pnLRange';

function niceDateLabel(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00Z');
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch {
    return d;
  }
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const usd = p.usd;
  const eth = p.eth;
  return (
    <div style={{ background: '#0b0b11', padding: 8, border: '1px solid rgba(255,255,255,0.03)', color: '#e6eef6' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.date}</div>
      <div style={{ fontWeight: 700 }}>{typeof usd === 'number' ? `$${usd.toFixed(2)}` : `${eth.toFixed(6)} ETH`}</div>
    </div>
  );
}

export default function PnLChart({ defaultRange = 30 } : { defaultRange?: Range }) {
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<Range>(defaultRange as Range);
  const [viewUSD, setViewUSD] = useState(true);
  const [data, setData] = useState<any[]|null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const addr = address ?? '';

  useEffect(()=> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if ([7,30,90].includes(parsed)) setRange(parsed as Range);
      }
    } catch {}
  }, []);

  useEffect(()=> {
    try { localStorage.setItem(STORAGE_KEY, String(range)); } catch {}
  }, [range]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let mountedLocal = true;
    if (!addr) {
      setData(null);
      setErr('Connect wallet to view PnL history');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    setData(null);

    (async () => {
      try {
        const res = await fetch(`/api/wallet/${addr}/pnl?rangeDays=${range}`);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!mountedLocal) return;
        const series = (json.series ?? []).map((p: any) => ({
          date: p.date,
          label: niceDateLabel(p.date),
          eth: Number(p.eth ?? 0),
          usd: p.usd !== null && p.usd !== undefined ? Number(p.usd) : null,
        }));
        setData(series);
        setLoading(false);
      } catch (e: any) {
        if (!mountedLocal) return;
        setErr(String(e?.message ?? e));
        setLoading(false);
      }
    })();

    return () => { mountedLocal = false; };
  }, [addr, range, mounted]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      date: d.date,
      label: d.label,
      eth: d.eth,
      usd: d.usd,
      value: viewUSD ? (d.usd ?? (d.eth * (d.usd ?? 0))) : d.eth
    }));
  }, [data, viewUSD]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Portfolio PnL ({range} days)</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Address: {addr ? addr : '[not connected]'} · Note: currently ETH-only history (tokens not reconstructed).
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[7,30,90].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r as Range)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.03)',
                  background: r === range ? 'linear-gradient(90deg, var(--accent-a), var(--accent-b))' : 'transparent',
                  color: r === range ? '#041414' : 'var(--muted)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {r}d
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={viewUSD ? 'usd' : 'eth'} onChange={(e)=> setViewUSD(e.target.value === 'usd')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.03)', color: 'var(--muted)', padding: '6px 8px', borderRadius: 8 }}>
              <option value="usd">View: USD</option>
              <option value="eth">View: ETH</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ height: 300 }}>
        {loading && <div style={{ color: 'var(--muted)', padding: 20 }}>Loading…</div>}
        {err && <div style={{ color: 'salmon', padding: 12 }}>{err}</div>}
        {!loading && !err && data && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--accent-a)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--accent-b)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke="url(#pnlGradient)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6, strokeWidth: 2, fill: '#041414' }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {!loading && !err && (!data || chartData.length === 0) && (
          <div style={{ color: 'var(--muted)', padding: 20 }}>No history available — showing fallback to current balance.</div>
        )}
      </div>
    </div>
  );
}
