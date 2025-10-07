// scripts/auto_verify.js
// Usage:
//   1) npx hardhat --config hardhat.config.cjs flatten contracts/WalletInsights.sol > flat-WalletInsights.sol
//   2) AURORA_API_KEY=yourkey node scripts/auto_verify.js 0xYourContractAddress
//
// This script posts the flattened source as a single-file Solidity submission to the Aurora Explorer API
// and polls for verification status.

import fs from "fs";
import process from "process";
import fetch from "node-fetch"; // if using Node 18+, you can remove this import

// Aurora Explorer API base
const AURORA_API_BASE = process.env.AURORA_EXPLORER_API || "https://0x4e4542a7.explorer.aurora-cloud.dev/api";

async function postForm(url, params) {
  const body = new URLSearchParams();
  for (const k of Object.keys(params)) body.append(k, params[k]);
  const res = await fetch(url, { method: "POST", body });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error("Non-JSON response: " + text); }
}

async function checkStatus(url, guid, apiKey) {
  const params = new URLSearchParams({
    module: "contract",
    action: "checkverifystatus",
    guid,
    apikey: apiKey,
  });
  const res = await fetch(url + "?" + params.toString());
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error("Non-JSON status response: " + text); }
}

async function main() {
  if (process.argv.length < 3) {
    console.error("Usage: node scripts/auto_verify.js <contract-address>");
    process.exit(1);
  }

  const address = process.argv[2];
  const flatFile = process.argv[3] || "flat-WalletInsights.sol";

  const apiKey = process.env.AURORA_API_KEY || "aurora";
  if (!apiKey) {
    console.error("Missing AURORA_API_KEY — set it in .env or as an environment variable.");
    process.exit(1);
  }

  if (!fs.existsSync(flatFile)) {
    console.error("❌ Flat file not found:", flatFile);
    console.error("Run: npx hardhat --config hardhat.config.cjs flatten contracts/WalletInsights.sol > " + flatFile);
    process.exit(1);
  }

  const sourceCode = fs.readFileSync(flatFile, "utf8");

  console.log("🚀 Posting verification request to Aurora Explorer...");
  const postPayload = {
    module: "contract",
    action: "verifysourcecode",
    apikey: apiKey,
    contractaddress: address,
    sourceCode: sourceCode,
    codeformat: "solidity-single-file",
    contractname: "WalletInsights",
    compilerversion: "v0.8.19+commit.7dd6d404",
    optimizationUsed: "1",
    runs: "200",
    licenseType: "3",
  };

  const submit = await postForm(AURORA_API_BASE, postPayload);
  if (!submit || submit.status != "1") {
    console.error("❌ Submission failed:", submit);
    process.exit(1);
  }

  const guid = submit.result;
  console.log("📨 Submitted. GUID:", guid);
  console.log("⏳ Polling verification status...");

  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const status = await checkStatus(AURORA_API_BASE, guid, apiKey);
    if (status.status === "1") {
      console.log("✅ Verified! 🎉");
      console.log("Explorer link: https://explorer.aurora.dev/address/" + address + "#code");
      return;
    } else if ((status.result || "").includes("Pending")) {
      console.log("⌛ Pending:", status.result);
      continue;
    } else {
      console.error("❌ Verification failed:", status);
      process.exit(1);
    }
  }

  console.error("⚠️ Timeout waiting for verification result. Check manually at:");
  console.error("👉 https://explorer.aurora.dev/address/" + address + "#code");
}

main().catch((e) => {
  console.error("❌ ERROR:", e.message || e);
  process.exit(1);
});
