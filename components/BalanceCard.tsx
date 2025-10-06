'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { usePortfolio } from '../lib/apiHooks';
import AssetsBreakdown from './AssetsBreakdown';

export default function BalanceCard() {
  const { address } = useAccount();
  const { data, loading, error } = usePortfolio(address ?? undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalUsd = useMemo(() => data?.totalUsd ?? 0, [data]);

  return (
    <div
      className="card"
      style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Portfolio balance</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {loading
            ? 'Loading…'
            : `$${totalUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </div>
        <div style={{ color: 'var(--muted)', marginTop: 6 }}>
          {loading ? 'Fetching data...' : error ? '⚠️ Failed to load' : `Assets: ${data?.assets?.length ?? 0}`}
        </div>

        {/* Only show wallet address after client mount to avoid hydration mismatch */}
        {mounted && address && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
            Address: <strong>{address}</strong>
          </div>
        )}
      </div>

      <div style={{ width: 220, display: 'flex', justifyContent: 'flex-end' }}>
        <AssetsBreakdown size={160} assets={data?.assets ?? []} />
      </div>
    </div>
  );
}
