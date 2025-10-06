/**
 * hardhat/scripts/deploy_hh.cjs
 * Run with:
 *   npx hardhat run --network aurora hardhat/scripts/deploy_hh.cjs
 */
(async () => {
  try {
    const hre = require('hardhat');
    const { ethers } = hre;

    console.log('Network RPC:', hre.network.config.url);
    console.log('Deploying WalletInsights via Hardhat runtime...');

    const WalletInsights = await ethers.getContractFactory('WalletInsights');
    const contract = await WalletInsights.deploy();
    console.log('Tx:', contract.deployTransaction.hash);
    await contract.deployed();
    console.log('Deployed address:', contract.address);
    console.log(`Explorer: https://0x4e4542a7.explorer.aurora-cloud.dev/address/${contract.address}`);

    // Optionally write to .env.local (create/update NEXT_PUBLIC_WALLET_INSIGHTS_ADDR)
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env.local');
      let env = '';
      try { env = fs.readFileSync(envPath, 'utf8'); } catch (e) { env = ''; }
      const line = `NEXT_PUBLIC_WALLET_INSIGHTS_ADDR=${contract.address}`;
      if (!env.includes('NEXT_PUBLIC_WALLET_INSIGHTS_ADDR=')) env += `\n${line}\n`;
      else env = env.replace(/NEXT_PUBLIC_WALLET_INSIGHTS_ADDR=.*/g, line);
      fs.writeFileSync(envPath, env);
      console.log('Updated .env.local with NEXT_PUBLIC_WALLET_INSIGHTS_ADDR');
    } catch (e) {
      console.warn('Could not update .env.local:', e?.message ?? e);
    }

    process.exit(0);
  } catch (err) {
    console.error('Deployment failed:', err);
    process.exit(1);
  }
})();
