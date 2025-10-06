'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { pushToast } from './Toast';

/**
 * WalletConnect — Handles injected wallet connection (MetaMask, Brave, etc.)
 * with SSR-safe hydration guard + shimmer placeholder.
 */
type Props = {
  onAddressChange?: (address: string | null) => void;
};

export default function WalletConnect({ onAddressChange }: Props) {
  const { address, isConnected, status } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  // ✅ Prevent hydration mismatch by delaying render until client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Notify parent (like ChatWindow) when wallet state changes
  useEffect(() => {
    if (mounted) {
      onAddressChange?.(isConnected && address ? address : null);
    }
  }, [address, isConnected, status, mounted, onAddressChange]);

  const handleConnect = async () => {
    try {
      console.log('🦊 handleConnect: attempting injected()');
      await connect({ connector: injected() });
      pushToast('✅ Wallet connected');
    } catch (err) {
      console.error('handleConnect: manual eth_requestAccounts error ->', err);
      pushToast('⚠️ Wallet connection blocked or failed');
    }
  };

  const handleDisconnect = async () => {
    try {
      disconnect();
      onAddressChange?.(null);
      pushToast('🔌 Wallet disconnected');
    } catch (err) {
      console.error('handleDisconnect error', err);
    }
  };

  // helper to format addresses
  const shortAddr = (a?: string) =>
    a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';

  // 🩵 Placeholder shimmer while client hydrates (prevents mismatch)
  if (!mounted) {
    return (
      <div
        style={{
          height: 40,
          width: 120,
          borderRadius: 999,
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%)',
          backgroundSize: '200% 100%',
          animation: 'wallet-shimmer 1.4s linear infinite',
        }}
      />
    );
  }

  // 🪙 Not connected
  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="wallet-cta"
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          background: 'linear-gradient(90deg, var(--accent-a), var(--accent-b))',
          color: '#041414',
          border: 0,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          transition: 'transform .08s ease, box-shadow .12s ease',
        }}
      >
        Connect Wallet
      </button>
    );
  }

  // ✅ Connected UI
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        className="wallet-pill"
        style={{
          padding: '8px 12px',
          borderRadius: 999,
          background: 'rgba(18,18,22,0.85)',
          color: '#e6eef6',
          border: '1px solid rgba(255,255,255,0.03)',
          fontWeight: 700,
        }}
      >
        {shortAddr(address)}
      </div>

      <button
        onClick={handleDisconnect}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: 8,
          color: 'var(--muted)',
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 13,
          transition: 'transform .08s ease, opacity .12s ease',
        }}
      >
        Disconnect
      </button>

      <style jsx>{`
        @keyframes wallet-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
