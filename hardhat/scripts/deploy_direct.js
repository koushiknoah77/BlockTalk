// hardhat/scripts/deploy_direct.js
// ===============================================================
// Robust deploy + verify + frontend-update script for Hardhat v3 + Node 20+/22+
// - Deploys WalletInsights
// - Saves deployments/aurora.json
// - Updates lib/insightContract.ts (frontend) with the address
// - Tries programmatic verify then falls back to CLI verify variants with retries
// - Uses dynamic import normalization for the Hardhat runtime
// ===============================================================

import { ethers as EthersLib } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const DEPLOYMENTS_PATH = "./deployments/aurora.json";
const FRONTEND_ADDRESS_FILE = "./lib/insightContract.ts";
const FRONTEND_EXPORT_NAME = "WALLET_INSIGHTS_ADDRESS";

// small sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** run a child process synchronously but capture output (async wrapper) */
async function runSpawnSync(cmd, args, env = {}, timeout = 120_000) {
  // dynamic import because this file is ESM (require is not defined)
  const child_mod = await import("child_process");
  // spawnSync is available on child_mod
  const res = child_mod.spawnSync(cmd, args, {
    encoding: "utf-8",
    stdio: "pipe",
    env: { ...process.env, ...env },
    timeout,
  });
  return {
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    error: res.error,
  };
}

/** Try multiple CLI verify variants (returns true if succeeded) */
async function tryCliVerifyVariants(address, constructorArgsPath = null, maxAttemptsPerVariant = 2) {
  // variants to try (array of {label, cmd, args})
  const variants = [
    {
      label: "npx hardhat verify (top-level verify)",
      cmd: "npx",
      args: ["hardhat", "verify", "--config", "hardhat.config.cjs", "--network", "aurora", address],
    },
    {
      label: "npx hardhat verify:verify (namespaced)",
      cmd: "npx",
      args: ["hardhat", "verify:verify", "--config", "hardhat.config.cjs", "--network", "aurora", "--address", address],
    },
    {
      label: "node ./node_modules/.bin/hardhat verify (local binary)",
      cmd: "node",
      args: ["./node_modules/.bin/hardhat", "verify", "--config", "hardhat.config.cjs", "--network", "aurora", address],
    },
    {
      label: "node ./node_modules/.bin/hardhat verify:verify (local binary namespaced)",
      cmd: "node",
      args: ["./node_modules/.bin/hardhat", "verify:verify", "--config", "hardhat.config.cjs", "--network", "aurora", "--address", address],
    },
  ];

  // If constructor args path provided, append flag to args where supported.
  // Note: different plugin versions use different flags; we attempt the common forms by appending one form.
  if (constructorArgsPath) {
    for (const v of variants) {
      v.args = [...v.args, "--constructor-args-path", constructorArgsPath];
    }
  }

  for (const v of variants) {
    for (let attempt = 1; attempt <= maxAttemptsPerVariant; attempt++) {
      console.log(`🔁 CLI verify attempt ${attempt}/${maxAttemptsPerVariant} using variant: ${v.label}`);
      const r = await runSpawnSync(v.cmd, v.args, process.env, 120_000);

      if (r.stdout && r.stdout.trim()) console.log(`--- CLI STDOUT (${v.label}) ---\n${r.stdout}`);
      if (r.stderr && r.stderr.trim()) console.error(`--- CLI STDERR (${v.label}) ---\n${r.stderr}`);

      if (r.status === 0) {
        console.log(`✅ Variant succeeded: ${v.label}`);
        return true;
      } else {
        console.warn(`⚠️ Variant failed (exit ${r.status}) for ${v.label}`);
        // small exponential backoff
        await sleep(2000 * attempt);
      }
    }
    console.log(`ℹ️ Moving to next verification variant after failures: ${v.label}`);
  }

  return false;
}

async function main() {
  // normalize Hardhat runtime import shape
  const _hardhat = await import("hardhat");
  const hre = _hardhat?.default ?? _hardhat;

  console.log("🚀 Deploying WalletInsights to Aurora Virtual Chain...");

  // --- env
  const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.PK;
  const AURORA_RPC =
    process.env.AURORA_RPC ||
    process.env.NEXT_PUBLIC_AURORA_RPC_URL ||
    "https://0x4e4542a7.rpc.aurora-cloud.dev";
  // optional API key (used by verify plugin)
  const AURORA_API_KEY = process.env.AURORA_API_KEY;

  if (!PRIVATE_KEY) throw new Error("❌ Missing PRIVATE_KEY in .env");

  // --- provider + wallet (ethers full lib)
  const provider = new EthersLib.JsonRpcProvider(AURORA_RPC);
  const wallet = new EthersLib.Wallet(
    PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : "0x" + PRIVATE_KEY,
    provider
  );

  console.log(`👤 Deployer address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${EthersLib.formatEther(balance)} ETH`);

  // --- read artifact and build ContractFactory
  const artifact = await hre.artifacts.readArtifact("WalletInsights").catch((err) => {
    throw new Error("Artifact read failed: " + err.message);
  });
  const Factory = new EthersLib.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("📡 Deploying contract (using adjusted gas price for Aurora)...");
  // adjust as needed; this value worked in your runs but you can lower it
  const gasPrice = EthersLib.parseUnits("1000", "gwei"); // adjust if your chain's min differs

  const contract = await Factory.deploy({
    gasPrice,
    gasLimit: 2_000_000,
  });

  console.log("⏳ Waiting for confirmation...");
  // wait for deployment (handle possible shapes)
  if (typeof contract.waitForDeployment === "function") {
    await contract.waitForDeployment();
  } else if (typeof contract.deployed === "function") {
    await contract.deployed();
  } else {
    // fallback: wait for tx hash
    const txHash = contract.deployTransaction?.hash ?? contract.deploymentTransaction?.hash;
    if (txHash) await provider.waitForTransaction(txHash);
  }

  const address = contract.target ?? contract.address;
  console.log("✅ Deployed successfully!");
  console.log(`📄 Contract Address: ${address}`);
  console.log(`🔗 Explorer: https://0x4e4542a7.explorer.aurora-cloud.dev/address/${address}`);

  // --- persist deployment
  try {
    fs.mkdirSync("./deployments", { recursive: true });
    fs.writeFileSync(
      DEPLOYMENTS_PATH,
      JSON.stringify({ WalletInsights: address, timestamp: new Date().toISOString() }, null, 2)
    );
    console.log(`📝 Saved deployment to ${DEPLOYMENTS_PATH}`);
  } catch (err) {
    console.warn("⚠️ Failed to save deployment file:", err?.message ?? err);
  }

  // --- update frontend address file
  try {
    const frontendDir = FRONTEND_ADDRESS_FILE.split("/").slice(0, -1).join("/") || ".";
    fs.mkdirSync(frontendDir, { recursive: true });
    const content = `// Auto-generated by hardhat/scripts/deploy_direct.js\nexport const ${FRONTEND_EXPORT_NAME} = "${address}";\n`;
    fs.writeFileSync(FRONTEND_ADDRESS_FILE, content, "utf-8");
    console.log(`🧩 Updated frontend address file: ${FRONTEND_ADDRESS_FILE}`);
  } catch (err) {
    console.warn("⚠️ Failed to update frontend file:", err?.message ?? err);
  }

  // --- verification: try hre.run first (best), else CLI fallback with retries
  let verified = false;

  // 1) programmatic verify (if hre.run available)
  try {
    if (typeof hre.run === "function") {
      console.log("🔍 Attempting in-process verification via hre.run()...");
      await hre.run("verify:verify", {
        address,
        constructorArguments: [], // <-- add args here if required
      });
      console.log("✅ Verified via hre.run()");
      verified = true;
    } else {
      console.log("ℹ️ hre.run not available; skipping in-process verify.");
    }
  } catch (err) {
    console.warn("⚠️ In-process verification failed:", err?.message ?? err);
    // continue to CLI fallback
  }

  // 2) CLI fallback if not verified
  if (!verified) {
    console.log("🔁 Trying CLI verification variants (will capture and print plugin output)...");
    // If your contract requires constructor args for verification, set constructorArgsPath to "./scripts/verify-args.js"
    const constructorArgsPath = null;
    const ok = await tryCliVerifyVariants(address, constructorArgsPath, 2);
    if (ok) {
      verified = true;
    } else {
      console.warn("⚠️ CLI verification exhausted all variants/attempts.");
    }
  }

  if (!verified) {
    console.warn("⚠️ Contract verification was skipped or failed. Manual retry command:");
    console.log(`  npx hardhat verify --config hardhat.config.cjs --network aurora ${address}`);
    console.log(`  or: npx hardhat verify:verify --config hardhat.config.cjs --network aurora --address ${address}`);
  }

  console.log("🎉 Deployment script finished. RESULT:", JSON.stringify({ address, verified }));
  return { address, verified };
}

// run
main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exitCode = 1;
});
