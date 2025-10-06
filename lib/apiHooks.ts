// lib/apiHooks.ts
import { useEffect, useState } from 'react';

type Portfolio = {
  address?: string;
  totalUsd?: number;
  assets?: { symbol: string; name?: string; balance: number; usd: number }[];
  source?: string;
};

export function usePortfolio(address?: string) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/wallet/${address}/portfolio`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('usePortfolio error', e);
        setError(String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { data, loading, error };
}

type TxsResp = {
  address?: string;
  txs?: any[];
  source?: string;
};

export function useTxs(address?: string) {
  const [data, setData] = useState<TxsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/wallet/${address}/txs`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('useTxs error', e);
        setError(String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { data, loading, error };
}
