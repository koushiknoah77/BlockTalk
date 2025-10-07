// lib/insightContract.ts
// Unified Aurora WalletInsights integration layer for BlockTalk
// Exports:
//   - WALLET_INSIGHTS_ADDRESS (verified Aurora contract)
//   - WALLET_INSIGHTS_ABI (minimal ABI)
//   - publicClient (for reads)
//   - writeLogInsight(query, answer): Promise<{ hash: string }>

import { createPublicClient, http } from "viem";
import { ethers } from "ethers";

// ✅ your verified contract
export const WALLET_INSIGHTS_ADDRESS =
  "0xB09DE84A8ACe57c28425a2557Abcb2cdF4fAb572";

// ✅ minimal ABI for read/write + event
export const WALLET_INSIGHTS_ABI = [
  {
    inputs: [
      { internalType: "string", name: "query", type: "string" },
      { internalType: "string", name: "answer", type: "string" },
    ],
    name: "logInsight",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "getInsight",
    outputs: [
      {
        components: [
          { internalType: "address", name: "user", type: "address" },
          { internalType: "string", name: "query", type: "string" },
          { internalType: "string", name: "answer", type: "string" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        internalType: "struct WalletInsights.Insight",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "string", name: "query", type: "string" },
      { indexed: false, internalType: "string", name: "answer", type: "string" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "InsightLogged",
    type: "event",
  },
];

// ✅ use NEXT_PUBLIC_AURORA_RPC_URL if provided, otherwise fallback
const AURORA_RPC =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AURORA_RPC_URL
    ? process.env.NEXT_PUBLIC_AURORA_RPC_URL
    : "https://0x4e4542a7.rpc.aurora-cloud.dev";

// ✅ publicClient for read-only queries
export const publicClient = createPublicClient({
  transport: http(AURORA_RPC),
});

/**
 * writeLogInsight(query, answer)
 * Uses the user's wallet (window.ethereum) to send a transaction
 * calling the verified WalletInsights contract.
 */
export async function writeLogInsight(query: string, answer: string): Promise<{ hash: string }> {
  if (typeof window === "undefined") {
    throw new Error("writeLogInsight must be called from the browser.");
  }

  if (!query || !answer) {
    throw new Error("Both query and answer are required.");
  }

  // get injected provider (MetaMask or compatible)
  const anyWindow = window as any;
  const ethProvider = anyWindow.ethereum;
  if (!ethProvider) {
    throw new Error("No wallet found — please install MetaMask or enable Aurora wallet injection.");
  }

  // connect to provider + signer
  const provider = new ethers.BrowserProvider(ethProvider);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(WALLET_INSIGHTS_ADDRESS, WALLET_INSIGHTS_ABI, signer);

  console.log("🟢 Logging insight on-chain:", { query, answer });

  try {
    const tx = await contract.logInsight(query, answer);
    console.log("⏳ Waiting for confirmation…", tx.hash);
    await tx.wait();
    console.log("✅ Insight logged successfully:", tx.hash);
    return { hash: tx.hash };
  } catch (err: any) {
    console.error("❌ Error during writeLogInsight:", err);
    throw new Error(err?.message || "Transaction failed");
  }
}
