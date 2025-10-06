// providers/WagmiProviders.tsx
'use client';

import React, { useEffect } from 'react';
import { WagmiConfig } from 'wagmi'; // <- correct provider wrapper name
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '../lib/wagmiClient';

const queryClient = new QueryClient();

export default function WagmiProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      // expose the wagmi config to window for debugging
      // @ts-ignore
      window.__wagmiConfig = wagmiConfig;
      console.log('🔌 WagmiProviders mounted — window.__wagmiConfig set');
    } catch (err) {
      console.warn('WagmiProviders debug error', err);
    }
  }, []);

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
}
