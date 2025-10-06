// hardhat/scripts/deploy.js
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Compiling & deploying WalletInsights via Hardhat runtime...');
  const WalletInsights = await ethers.getContractFactory('WalletInsights');

  console.log('Deploying contract...');
  const contract = await WalletInsights.deploy();
  console.log('Tx sent:', contract.deployTransaction.hash);
  await contract.deployed();
  console.log('✅ Deployed at:', contract.address);

  // Print explorer link (Aurora virtual chain explorer prefix)
  console.log(`Explorer: https://0x4e4542a7.explorer.aurora-cloud.dev/address/${contract.address}`);

  // Optionally write the address to .env.local (only if WRITE_ENV=1)
  try {
    if (process.env.WRITE_ENV === '1' || process.env.WRITE_ENV === 'true') {
      const envPath = path.join(process.cwd(), '.env.local');
      const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const key = 'NEXT_PUBLIC_WALLET_INSIGHTS_ADDR';
      const newLine = `${key}=${contract.address}\n`;
      const filtered = existing
        .split('\n')
        .filter(Boolean)
        .filter((l) => !l.startsWith(key + '='))
        .join('\n');
      const out = filtered ? filtered + '\n' + newLine : newLine;
      fs.writeFileSync(envPath, out, 'utf8');
      console.log(`Wrote ${key} to .env.local`);
    }
  } catch (e) {
    console.warn('Failed to write .env.local:', e?.message ?? e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Deployment error', err);
    process.exit(1);
  });
