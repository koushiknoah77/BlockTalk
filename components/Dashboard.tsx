// components/Dashboard.tsx
'use client';
import React from 'react';
import BalanceCard from './BalanceCard';
import AuroraBalanceCard from './AuroraBalanceCard';
import PnLChart from './PnLChart';
import TransactionsList from './TransactionsList';

export default function Dashboard() {
  return (
    <section className="dashboard" style={{ width: '100%', marginTop: 28 }}>
      <div className="dashboard-grid">
        {/* LEFT column */}
        <div>
          {/* Balance card (includes assets breakdown) */}
          <div style={{ marginBottom: 14 }}>
            <BalanceCard />
            <div style={{ marginTop: 12 }}>
              <AuroraBalanceCard />
            </div>
          </div>

          {/* PnL chart card */}
          <div style={{ marginTop: 14 }}>
            <PnLChart defaultRange={30} />
          </div>
        </div>

        {/* RIGHT column */}
        <div>
          <TransactionsList chain="eth" />
        </div>
      </div>
    </section>
  );
}
