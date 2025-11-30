require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY && process.env.NODE_ENV !== 'test') {
  console.warn("⚠️  WARNING: PRIVATE_KEY not found in .env file!");
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  
  networks: {
    hardhat: {
      chainId: 31337
    },
    
    pushTestnet: {
      url: "https://rpc.testnet.push.org",
      chainId: 42101,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      timeout: 60000
    }
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  mocha: {
    timeout: 120000
  }
};