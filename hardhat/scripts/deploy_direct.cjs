// hardhat/scripts/deploy_direct.cjs
//
// Direct deploy script for Aurora Virtual Chain.
// Works with ethers v5 and Hardhat v2.x
// Uses manual gasPrice to satisfy Aurora’s min (1e12 wei)

require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying WalletInsights to Aurora Virtual Chain...");

  // Load deployer wallet
  const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.PK;
  const AURORA_RPC =
    process.env.AURORA_RPC ||
    process.env.NEXT_PUBLIC_AURORA_RPC_URL ||
    "https://0x4e4542a7.rpc.aurora-cloud.dev";

  if (!PRIVATE_KEY) {
    throw new Error("❌ Missing PRIVATE_KEY in .env");
  }

  // Initialize provider + wallet
  const provider = new ethers.providers.JsonRpcProvider(AURORA_RPC);
  const wallet = new ethers.Wallet(
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : "0x" + PRIVATE_KEY,
    provider
  );

  console.log(`👤 Deployer address: ${wallet.address}`);
  const balance = await wallet.getBalance();
  console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);

  // Get contract factory
  const ContractFactory = await ethers.getContractFactory("WalletInsights", wallet);

  console.log("📡 Deploying contract with adjusted gas price...");
  const gasPrice = ethers.utils.parseUnits("1000", "gwei"); // ✅ Aurora min gas price (1e12 wei)

  const contract = await ContractFactory.deploy({
    gasPrice,
    gasLimit: 2_000_000, // safe limit
  });

  console.log(`⏳ Tx sent: ${contract.deployTransaction.hash}`);
  console.log("⛽ Waiting for confirmation...");
  await contract.deployed();

  console.log(`✅ Deployed successfully!`);
  console.log(`📄 Contract Address: ${contract.address}`);
  console.log(
    `🔗 Explorer: https://0x4e4542a7.explorer.aurora-cloud.dev/address/${contract.address}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
