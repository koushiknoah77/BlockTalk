// components/AuroraBalanceCard.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { publicClient } from '../lib/insightContract';

function fmtLaka(n?: number | null) {
  if (n === null || n === undefined) return 'n/a';
  return `${n.toFixed(6)} LAKA`;
}

export default function AuroraBalanceCard() {
  const { address } = useAccount();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!address) {
      setBalance(null);
      setErr('Not connected');
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const bal = await publicClient.getBalance({ address: address as `0x${string}` });
        const n = Number(bal) / 1e18;
        if (!mounted) return;
        setBalance(n);
      } catch (e: any) {
        console.error('AuroraBalanceCard error', e);
        if (!mounted) return;
        setErr(String(e?.message ?? e));
        setBalance(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [address]);

  return (
    <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aurora (LAKA) balance</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>
          {loading ? 'Loading…' : (balance !== null ? fmtLaka(balance) : (err ? 'Error' : '—'))}
        </div>
        <div style={{ color: 'var(--muted)', marginTop: 6 }}>{err ?? 'Native token on Aurora Virtual Chain'}</div>
      </div>
    </div>
  );
}
