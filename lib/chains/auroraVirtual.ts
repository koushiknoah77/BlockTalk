// lib/chains/auroraVirtual.ts
import { Chain } from 'viem';

export const auroraVirtual: Chain = {
  id: 1313161895,
  name: 'Aurora Virtual Chain',
  // note: 'network' field removed for compatibility with some viem type versions
  nativeCurrency: {
    name: 'LAKA',
    symbol: 'LAKA',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://0x4e4542a7.rpc.aurora-cloud.dev'] },
    public: { http: ['https://0x4e4542a7.rpc.aurora-cloud.dev'] },
  },
  blockExplorers: {
    default: {
      name: 'Aurora Virtual Explorer',
      url: 'https://0x4e4542a7.explorer.aurora-cloud.dev',
    },
  },
  testnet: false,
} as any;
