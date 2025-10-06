// lib/insightContract.ts
'use client';

import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
} from 'viem';
import { auroraVirtual } from './chains/auroraVirtual';
import { ensureAuroraNetwork } from './metaMask';

// RPC endpoint fallback (can override via NEXT_PUBLIC_AURORA_RPC_URL)
const AURORA_RPC =
  (process.env.NEXT_PUBLIC_AURORA_RPC_URL as string) ??
  (process.env.AURORA_RPC_URL as string) ??
  'https://0x4e4542a7.rpc.aurora-cloud.dev';

export const publicClient = createPublicClient({
  chain: auroraVirtual,
  transport: http(AURORA_RPC),
});

// Contract address (set via env or fallback)
export const walletInsightsAddress: Address =
  (process.env.NEXT_PUBLIC_WALLET_INSIGHTS_ADDR as Address) ??
  '0xB174d92Ae6AB5623072bBc0A2aC3E54E94CA63C3';

// Minimal ABI for WalletInsights.logInsight
export const walletInsightsAbi = [
  {
    inputs: [
      { internalType: 'string', name: 'query', type: 'string' },
      { internalType: 'string', name: 'answer', type: 'string' },
    ],
    name: 'logInsight',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const MAX_LEN = 1024; // max chars for query/answer to encode safely

type WriteResult = { hash: string };

/**
 * writeLogInsight:
 * - client-only
 * - ensures Aurora network (may prompt user)
 * - encodes calldata and attempts gas estimate (best-effort)
 * - sends eth_sendTransaction via window.ethereum
 */
export async function writeLogInsight(query: string, answer: string): Promise<WriteResult> {
  if (typeof window === 'undefined') throw new Error('writeLogInsight: client-only');

  if (!query) throw new Error('writeLogInsight: missing query');
  if (!answer) throw new Error('writeLogInsight: missing answer');

  // Clip to MAX_LEN to avoid accidentally huge calldata.
  if (query.length > MAX_LEN || answer.length > MAX_LEN) {
    throw new Error(`Query or answer too long (max ${MAX_LEN} characters).`);
  }

  const provider: any = (window as any).ethereum;
  if (!provider) throw new Error('writeLogInsight: no wallet provider found (window.ethereum)');

  // Ensure user is on Aurora chain (may prompt)
  try {
    await ensureAuroraNetwork();
  } catch (err: any) {
    throw new Error(`Please switch to Aurora network in your wallet: ${String(err?.message ?? err)}`);
  }

  // Request accounts
  let accounts: string[] = [];
  try {
    accounts = await provider.request({ method: 'eth_requestAccounts' });
  } catch (err: any) {
    throw new Error(`writeLogInsight: eth_requestAccounts failed: ${String(err?.message ?? err)}`);
  }

  const from = accounts && accounts.length > 0 ? accounts[0] : null;
  if (!from) throw new Error('writeLogInsight: no wallet account available');

  // Encode calldata for logInsight(query, answer)
  let data: `0x${string}`;
  try {
    data = encodeFunctionData({
      abi: walletInsightsAbi as any,
      functionName: 'logInsight' as any,
      args: [query, answer],
    }) as `0x${string}`;
  } catch (err: any) {
    throw new Error(`writeLogInsight: encoding calldata failed: ${String(err?.message ?? err)}`);
  }

  // Try to estimate gas (best-effort)
  let gasHex: string | undefined = undefined;
  try {
    const est: any = await publicClient.estimateGas({
      account: from as `0x${string}`,
      to: walletInsightsAddress,
      data,
    } as any);
    if (est !== undefined && est !== null) {
      const estBI = typeof est === 'bigint' ? est : BigInt(String(est));
      const buffered = estBI + BigInt(10000); // small buffer
      gasHex = '0x' + buffered.toString(16);
      console.log('writeLogInsight: estimated gas (wei) ->', String(buffered), 'hex', gasHex);
    }
  } catch (err) {
    console.warn('writeLogInsight: gas estimate failed (provider will estimate):', err);
  }

  const txPayload: any = {
    from,
    to: walletInsightsAddress,
    data,
  };
  if (gasHex) txPayload.gas = gasHex;

  // Send transaction via provider (MetaMask popup)
  try {
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [txPayload],
    });
    return { hash: txHash };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error('writeLogInsight: eth_sendTransaction failed:', msg);
    throw new Error(`Transaction failed or rejected: ${msg}`);
  }
}
