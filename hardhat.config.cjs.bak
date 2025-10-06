require('@nomiclabs/hardhat-ethers');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.PK || '';
const AURORA_RPC = process.env.AURORA_RPC || process.env.NEXT_PUBLIC_AURORA_RPC_URL || 'https://0x4e4542a7.rpc.aurora-cloud.dev';

module.exports = {
  solidity: { version: '0.8.19', settings: { optimizer: { enabled: true, runs: 200 } } },
  defaultNetwork: 'aurora',
  networks: {
    aurora: {
      url: AURORA_RPC,
      chainId: 1313161895,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : '0x' + PRIVATE_KEY] : [],
      timeout: 600000,
    },
    hardhat: { chainId: 1337 },
  },
  paths: { sources: './contracts', artifacts: './artifacts', cache: './cache' },
};
