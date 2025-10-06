// scripts/check-env.js
// Run: node -r dotenv/config scripts/check-env.js

const required = [
  "ALCHEMY_API_KEY",
  "ALCHEMY_NETWORK",
  "NEXT_PUBLIC_AURORA_RPC_URL",
  "NEXT_PUBLIC_WALLET_INSIGHTS_ADDR",
  // optionally add other keys you rely on here
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    "Missing required env vars (copy .env.local.example -> .env.local and fill):",
    missing.join(", ")
  );
  process.exit(1);
}
console.log("Env check passed.");
