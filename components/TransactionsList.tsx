'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { pushToast } from './Toast';
import { useAccount } from 'wagmi';
import { useTxs } from '../lib/apiHooks';

function explorerUrl(hash: string, chain: 'eth' | 'polygon' = 'eth') {
  if (!hash) return '#';
  if (chain === 'polygon') return `https://polygonscan.com/tx/${hash}`;
  return `https://etherscan.io/tx/${hash}`;
}

export default function TransactionsList({ chain = 'eth' }: { chain?: 'eth' | 'polygon' }) {
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lowerAddr = address ? address.toLowerCase() : null;

  const res: any = useTxs(address ?? undefined);
  const data = res?.data ?? res?.txs ?? null;
  const loading = res?.loading ?? res?.isLoading ?? false;
  const error = res?.error ?? res?.isError ?? null;

  const rawTxs =
    (data && data.txs)
      ? data.txs
      : Array.isArray(data)
      ? data
      : data?.items ?? [];

  const txs = useMemo(() => {
    if (!Array.isArray(rawTxs)) return [];
    return rawTxs
      .map((t: any) => {
        const hash = t.hash ?? t.transactionHash ?? null;

        const timestamp =
          t.date ??
          t.metadata?.blockTimestamp ??
          t.timeStamp ??
          t.blockTimestamp ??
          null;
        const date = timestamp ? new Date(timestamp).toLocaleString() : '';

        const symbol = t.symbol ?? t.asset ?? t.tokenSymbol ?? t.erc20Token?.tokenSymbol ?? 'ETH';

        const rawVal =
          t.amount ??
          t.value ??
          t.tokenAmount ??
          t.erc20Token?.value ??
          t.erc20Token?.rawValue ??
          0;
        const numVal =
          rawVal != null && !isNaN(Number(rawVal))
            ? Number(rawVal)
            : 0;

        const fromRaw = (t.from ?? t.fromAddress ?? t.sender ?? t.txFrom) || null;
        const toRaw = (t.to ?? t.toAddress ?? t.recipient ?? t.txTo) || null;
        const from = fromRaw ? String(fromRaw).toLowerCase() : null;
        const to = toRaw ? String(toRaw).toLowerCase() : null;

        let direction: 'in' | 'out' | 'unknown' = 'unknown';
        if (lowerAddr) {
          if (to === lowerAddr) direction = 'in';
          else if (from === lowerAddr) direction = 'out';
        } else {
          if (numVal > 0) direction = 'in';
        }

        return {
          original: t,
          hash,
          date,
          symbol,
          numVal,
          usd: t.usd ?? null,
          from,
          to,
          direction,
        };
      })
      .filter((t) => Math.abs(t.numVal) > 0)
      .sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, [rawTxs, lowerAddr]);

  // Render placeholder until mounted so server & client match
  if (!mounted) {
    return (
      <div
        className="card recent-activity-card"
        data-name="recent-activity"
        aria-live="polite"
      >
        <div className="tx-header">
          <div className="tx-title">Recent activity</div>
          <div className="tx-sub">Loading…</div>
        </div>
        <div style={{ padding: 12, color: 'var(--muted)' }}>Loading transactions…</div>
      </div>
    );
  }

  return (
    <div
      className="card recent-activity-card"
      data-name="recent-activity"
      aria-live="polite"
    >
      <div className="tx-header">
        <div className="tx-title">Recent activity</div>
        <div className="tx-sub">
          {loading ? 'Loading…' : error ? 'Failed to load' : `Source: ${data?.source ?? 'alchemy'}`}
        </div>
      </div>

      <ul className="tx-list" aria-hidden={false}>
        {loading && (
          <li style={{ padding: 12, color: 'var(--muted)' }}>
            Loading transactions…
          </li>
        )}

        {!loading && (!txs || txs.length === 0) && (
          <li style={{ padding: 12, color: 'var(--muted)' }}>
            No recent transactions
          </li>
        )}

        {txs.map((t: any) => {
          const txHash = t.hash;
          const incoming = t.direction === 'in';
          const outgoing = t.direction === 'out';

          const amountLabel = `${incoming ? '+' : ''}${t.numVal.toFixed(6)} ${t.symbol}`;
          const usdLabel =
            t.usd && !isNaN(Number(t.usd))
              ? `$${Number(t.usd).toFixed(2)}`
              : '';

          const dotStyle = {
            background: incoming ? 'var(--tx-in)' : outgoing ? 'var(--tx-out)' : 'var(--tx-neutral)',
          };
          const amountClass = incoming ? 'tx-amount positive' : outgoing ? 'tx-amount negative' : 'tx-amount';

          return (
            <li className="tx-row compact" key={txHash ?? Math.random()}>
              <div className="tx-left">
                <div className="tx-left-top">
                  <span className="tx-token-dot" aria-hidden style={dotStyle} />
                  <div className="tx-title-wrap">
                    <div className="tx-type">{incoming ? 'Received' : outgoing ? 'Sent' : 'Tx'}</div>
                    <div className="tx-hash" title={txHash ?? 'no-hash'}>
                      {txHash ? `${txHash.slice(0, 10)}…` : (t.original?.category ?? 'no-hash')}
                    </div>
                    <div className="tx-date">{t.date}</div>
                  </div>
                </div>
              </div>

              <div className="tx-right compact-right">
                {txHash ? (
                  <a
                    className={amountClass + " tx-amount-link"}
                    href={explorerUrl(txHash, chain)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in explorer"
                  >
                    {amountLabel}
                    <div className="tx-usd-inline">{usdLabel}</div>
                  </a>
                ) : (
                  <div className={amountClass}>
                    {amountLabel}
                    <div className="tx-usd-inline">{usdLabel}</div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
