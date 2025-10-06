// lib/metaMask.ts
export async function ensureAuroraNetwork(): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No wallet provider (window.ethereum) available; please install MetaMask or another wallet.');
  }

  const provider = (window as any).ethereum;
  const chainIdHex = '0x4e4542a7'; // 1313161895 in hex

  try {
    const current: string = await provider.request({ method: 'eth_chainId' });
    if (current === chainIdHex) return true;

    // Prompt wallet to add/switch to Aurora Virtual Chain
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: 'Aurora Virtual Chain',
          nativeCurrency: { name: 'LAKA', symbol: 'LAKA', decimals: 18 },
          rpcUrls: ['https://0x4e4542a7.rpc.aurora-cloud.dev'],
          blockExplorerUrls: ['https://0x4e4542a7.explorer.aurora-cloud.dev'],
        },
      ],
    });

    const after: string = await provider.request({ method: 'eth_chainId' });
    if (after === chainIdHex) return true;
    throw new Error('Failed to switch to Aurora chain - unexpected chainId after request.');
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (/user rejected|request rejected/i.test(msg)) {
      throw new Error('User rejected the wallet request to switch/add the Aurora network.');
    }
    throw new Error(`Failed to ensure Aurora network: ${msg}`);
  }
}
