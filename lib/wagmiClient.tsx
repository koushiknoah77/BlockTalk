// lib/wagmiClient.tsx
'use client';

import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { auroraVirtual } from './chains/auroraVirtual';

export const wagmiConfig = createConfig({
  chains: [auroraVirtual],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [auroraVirtual.id]: http('https://0x4e4542a7.rpc.aurora-cloud.dev'),
  } as any,
  ssr: true,
  autoConnect: true,
} as any);
