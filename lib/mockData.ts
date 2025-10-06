// lib/mockData.ts
export const mockBalance = 9950; // total USD

export const mockAssets = [
  { symbol: 'ETH', balance: 0.45, usd: 4200 },
  { symbol: 'USDC', balance: 2500, usd: 2500 },
  { symbol: 'DAI', balance: 500, usd: 500 },
  { symbol: 'WBTC', balance: 0.04, usd: 2750 }
];

export const mockPnl = [
  { date: '2025-09-01', value: 10000 },
  { date: '2025-09-05', value: 10400 },
  { date: '2025-09-10', value: 10440 },
  { date: '2025-09-15', value: 10480 },
  { date: '2025-09-20', value: 10620 },
  { date: '2025-09-25', value: 10600 },
  { date: '2025-09-29', value: 9950 }
];

export const mockTx = [
  { hash: '0xabc123def4567890', type: 'Send', amount: '-0.25 ETH', usd: -400.00, date: '2025-09-26' },
  { hash: '0xdef456abc1237890', type: 'Receive', amount: '+0.50 ETH', usd: 800.00, date: '2025-09-25' },
  { hash: '0xghi789jkl0123456', type: 'Swap', amount: '-200.00 USDC', usd: -200.00, date: '2025-09-23' }
];
