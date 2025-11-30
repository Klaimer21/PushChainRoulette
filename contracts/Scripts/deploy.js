const hre = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying PushChainRoulette to", hre.network.name, "...\n");
  console.log("📋 Testnet Version (No Chainlink VRF - Free!)");
  console.log("   Uses block.prevrandao + commit-reveal for randomness");
  console.log("   Perfect for testnet with no real funds\n");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "PC");
  console.log("");
  
  if (balance < hre.ethers.parseEther("0.1")) {
    console.warn("⚠️  WARNING: Low balance! You might not have enough PC for deployment.");
    console.warn("Get testnet PC from: https://faucet.push.org\n");
  }
  
  // Get the contract factory
  console.log("🔨 Compiling contracts...");
  const PushChainRoulette = await hre.ethers.getContractFactory("PushChainRoulette");
  
  // Deploy the contract (no VRF parameters needed!)
  console.log("🚀 Deploying PushChainRoulette...");
  const roulette = await PushChainRoulette.deploy();
  
  await roulette.waitForDeployment();
  const address = await roulette.getAddress();
  
  console.log("\n✅ PushChainRoulette deployed to:", address);
  console.log("🔗 View on explorer:", getExplorerUrl(hre.network.name, address));
  console.log("");
  
  // Fund the contract with initial house balance
  console.log("💰 Funding contract with house balance...");
  const fundAmount = hre.ethers.parseEther("100"); // 100 PC
  
  try {
    const fundTx = await roulette.depositFunds({ value: fundAmount });
    await fundTx.wait();
    console.log("✅ Contract funded with 100 PC");
  } catch (error) {
    console.warn("⚠️  Failed to fund contract:", error.message);
    console.warn("You can fund it manually later using depositFunds()");
  }
  
  console.log("");
  
  // Get and display stats
  console.log("📊 Contract Stats:");
  try {
    const stats = await roulette.getStats();
    console.log("   Contract Balance:", hre.ethers.formatEther(stats[0]), "PC");
    console.log("   Available Balance:", hre.ethers.formatEther(stats[1]), "PC");
    console.log("   Spin Cost:", hre.ethers.formatEther(stats[2]), "PC");
    console.log("   Is Paused:", stats[3]);
  } catch (error) {
    console.warn("⚠️  Could not fetch stats:", error.message);
  }
  
  console.log("");
  console.log("=" .repeat(70));
  console.log("");
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("");
  console.log("⚠️  IMPORTANT: Save these values!");
  console.log("");
  console.log("CONTRACT_ADDRESS =", address);
  console.log("NETWORK =", hre.network.name);
  console.log("CHAIN_ID =", hre.network.config.chainId);
  console.log("");
  console.log("=" .repeat(70));
  console.log("");
  
  // Next steps
  console.log("📝 Next Steps:");
  console.log("");
  console.log("1. Update frontend configuration:");
  console.log("   • Copy CONTRACT_ADDRESS to src/App.jsx");
  console.log("   • Update line: const CONTRACT_ADDRESS = '" + address + "';");
  console.log("");
  console.log("2. Choose your spin method:");
  console.log("   • quickSpin() - Instant results (recommended for testnet)");
  console.log("   • commitSpin() + revealSpin() - More secure (2 transactions)");
  console.log("");
  console.log("3. Test the contract:");
  console.log("   • Connect wallet to DApp");
  console.log("   • Try a spin");
  console.log("   • Check transaction on explorer");
  console.log("");
  console.log("4. Verify contract (optional):");
  console.log("   npx hardhat verify --network", hre.network.name, address);
  console.log("");
  console.log("=" .repeat(70));
  console.log("");
  console.log("ℹ️  RANDOMNESS INFO:");
  console.log("");
  console.log("This testnet version uses:");
  console.log("• block.prevrandao (post-merge random beacon)");
  console.log("• Block hashes");
  console.log("• Timestamps");
  console.log("• Player addresses");
  console.log("• Internal nonce");
  console.log("");
  console.log("✅ Good for testnet (no real money)");
  console.log("❌ Not suitable for mainnet with real funds");
  console.log("");
  console.log("For mainnet: Integrate Chainlink VRF when available on Push Chain");
  console.log("");
  console.log("=" .repeat(70));
  console.log("");
  
  // Save deployment info to file
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contractAddress: address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    transactionHash: roulette.deploymentTransaction()?.hash,
    version: "testnet-no-vrf",
    randomnessMethod: "block.prevrandao + commit-reveal"
  };
  
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("💾 Deployment info saved to:", `deployment-${hre.network.name}.json`);
  console.log("");
}

function getExplorerUrl(networkName, address) {
  const explorers = {
    pushTestnet: `https://donut.push.network/address/${address}`,
    pushMainnet: `https://scan.push.org/address/${address}`,
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
    hardhat: `Local network (no explorer)`
  };
  
  return explorers[networkName] || `Unknown network: ${networkName}`;
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });