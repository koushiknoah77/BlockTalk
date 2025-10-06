// hardhat/scripts/deploy_direct.js
// ESM variant for environments with "type": "module" in package.json
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const RPC = process.env.AURORA_RPC ?? "https://0x4e4542a7.rpc.aurora-cloud.dev";
const PRIV = process.env.PRIVATE_KEY || process.env.PK || process.env.PK_ALT;

if (!PRIV) {
  console.error("❌ No PRIVATE_KEY found in .env. Please add it before running.");
  process.exit(1);
}

async function main() {
  console.log("🚀 Directly deploying WalletInsights to Aurora...");

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIV.startsWith("0x") ? PRIV : "0x" + PRIV, provider);

  const artifactPath = path.join(
    process.cwd(),
    "artifacts",
    "contracts",
    "WalletInsights.sol",
    "WalletInsights.json"
  );

  if (!fs.existsSync(artifactPath)) {
    console.error("❌ Contract artifact not found:", artifactPath);
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const { abi, bytecode } = artifact;

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log("👤 Deployer:", wallet.address);

  try {
    // Safer gasPrice: query provider and add 10% buffer
    const gasPrice = await provider.getGasPrice();
    const adjusted = gasPrice.mul(110).div(100); // +10%
    console.log("Estimated gasPrice:", gasPrice.toString(), "adjusted:", adjusted.toString());

    const contract = await factory.deploy({ gasPrice: adjusted });
    console.log("📨 Tx sent:", contract.deployTransaction.hash);
    console.log("⏳ Waiting for confirmation...");
    await contract.deployed();

    console.log("✅ Deployed successfully!");
    console.log("📄 Contract Address:", contract.address);
    console.log(
      `🔗 Explorer: https://0x4e4542a7.explorer.aurora-cloud.dev/address/${contract.address}`
    );
  } catch (err) {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Deployment failed (main catch):", err);
  process.exit(1);
});
