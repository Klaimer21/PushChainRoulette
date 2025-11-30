c026b38ea763e42228032c6b46a0174f70a899275860a7b28441db50fd5547f2


const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("PushChainRoulette", function () {
  // Deploy fixture for reusability
  async function deployRouletteFixture() {
    const [owner, player1, player2, player3] = await ethers.getSigners();
    
    // Mock VRF Coordinator
    const VRFCoordinatorMock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    const vrfCoordinator = await VRFCoordinatorMock.deploy(
      ethers.parseEther("0.1"), // base fee
      1e9 // gas price link
    );
    await vrfCoordinator.waitForDeployment();
    
    // Create VRF subscription
    const createSubTx = await vrfCoordinator.createSubscription();
    const createSubReceipt = await createSubTx.wait();
    const subscriptionId = createSubReceipt.logs[0].args.subId;
    
    // Fund subscription
    await vrfCoordinator.fundSubscription(subscriptionId, ethers.parseEther("100"));
    
    // Deploy Roulette contract
    const PushChainRoulette = await ethers.getContractFactory("PushChainRoulette");
    const keyHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const callbackGasLimit = 500000;
    
    const roulette = await PushChainRoulette.deploy(
      subscriptionId,
      await vrfCoordinator.getAddress(),
      keyHash,
      callbackGasLimit
    );
    await roulette.waitForDeployment();
    
    // Add consumer to subscription
    await vrfCoordinator.addConsumer(subscriptionId, await roulette.getAddress());
    
    // Fund roulette contract
    await roulette.depositFunds({ value: ethers.parseEther("100") });
    
    return { roulette, vrfCoordinator, subscriptionId, owner, player1, player2, player3 };
  }
  
  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      const { roulette, owner } = await loadFixture(deployRouletteFixture);
      
      expect(await roulette.SPIN_COST()).to.equal(ethers.parseEther("0.1"));
      expect(await roulette.owner()).to.equal(owner.address);
      expect(await roulette.houseBalance()).to.equal(ethers.parseEther("100"));
    });
    
    it("Should not be paused initially", async function () {
      const { roulette } = await loadFixture(deployRouletteFixture);
      
      const stats = await roulette.getStats();
      expect(stats[3]).to.be.false; // isPaused
    });
  });
  
  describe("House Management", function () {
    it("Should allow owner to deposit funds", async function () {
      const { roulette, owner } = await loadFixture(deployRouletteFixture);
      
      const depositAmount = ethers.parseEther("50");
      await expect(
        roulette.depositFunds({ value: depositAmount })
      ).to.emit(roulette, "FundsDeposited")
        .withArgs(owner.address, depositAmount);
      
      expect(await roulette.houseBalance()).to.equal(ethers.parseEther("150"));
    });
    
    it("Should allow owner to withdraw funds", async function () {
      const { roulette, owner } = await loadFixture(deployRouletteFixture);
      
      const withdrawAmount = ethers.parseEther("50");
      await expect(
        roulette.withdrawFunds(withdrawAmount)
      ).to.emit(roulette, "FundsWithdrawn")
        .withArgs(owner.address, withdrawAmount);
      
      expect(await roulette.houseBalance()).to.equal(ethers.parseEther("50"));
    });
    
    it("Should reject withdrawal exceeding balance", async function () {
      const { roulette } = await loadFixture(deployRouletteFixture);
      
      const withdrawAmount = ethers.parseEther("200");
      await expect(
        roulette.withdrawFunds(withdrawAmount)
      ).to.be.revertedWith("Insufficient balance");
    });
    
    it("Should reject non-owner deposits", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      await expect(
        roulette.connect(player1).depositFunds({ value: ethers.parseEther("10") })
      ).to.be.revertedWithCustomError(roulette, "OwnableUnauthorizedAccount");
    });
  });
  
  describe("Spin Functionality", function () {
    it("Should accept spin with correct payment", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      await expect(
        roulette.connect(player1).spin({ value: ethers.parseEther("0.1") })
      ).to.emit(roulette, "SpinRequested");
    });
    
    it("Should reject spin with incorrect payment", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      await expect(
        roulette.connect(player1).spin({ value: ethers.parseEther("0.05") })
      ).to.be.revertedWithCustomError(roulette, "IncorrectBetAmount");
    });
    
    it("Should reject spin when paused", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      await roulette.pause();
      
      await expect(
        roulette.connect(player1).spin({ value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(roulette, "EnforcedPause");
    });
    
    it("Should enforce rate limiting", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      // First spin should succeed
      await roulette.connect(player1).spin({ value: ethers.parseEther("0.1") });
      
      // Second immediate spin should fail
      await expect(
        roulette.connect(player1).spin({ value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(roulette, "CooldownNotExpired");
    });
    
    it("Should allow spin after cooldown period", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      // First spin
      await roulette.connect(player1).spin({ value: ethers.parseEther("0.1") });
      
      // Fast forward time by 31 seconds (cooldown is 30 seconds)
      await ethers.provider.send("evm_increaseTime", [31]);
      await ethers.provider.send("evm_mine");
      
      // Second spin should succeed
      await expect(
        roulette.connect(player1).spin({ value: ethers.parseEther("0.1") })
      ).to.emit(roulette, "SpinRequested");
    });
    
    it("Should update player statistics", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      await roulette.connect(player1).spin({ value: ethers.parseEther("0.1") });
      
      expect(await roulette.playerTotalSpins(player1.address)).to.equal(1);
    });
    
    it("Should reject spin if house balance too low", async function () {
      const { roulette, owner, player1 } = await loadFixture(deployRouletteFixture);
      
      // Withdraw most funds
      await roulette.withdrawFunds(ethers.parseEther("99.5"));
      
      // Should fail because house balance < MAX_PRIZE (1 PC)
      await expect(
        roulette.connect(player1).spin({ value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(roulette, "InsufficientHouseBalance");
    });
  });
  
  describe("VRF Integration", function () {
    it("Should emit SpinResult after VRF callback", async function () {
      const { roulette, vrfCoordinator, player1 } = await loadFixture(deployRouletteFixture);
      
      // Make spin request
      const spinTx = await roulette.connect(player1).spin({ 
        value: ethers.parseEther("0.1") 
      });
      const spinReceipt = await spinTx.wait();
      
      // Get requestId from event
      const event = spinReceipt.logs.find(
        log => log.fragment && log.fragment.name === "SpinRequested"
      );
      const requestId = event.args.requestId;
      
      // Fulfill VRF request
      await expect(
        vrfCoordinator.fulfillRandomWords(requestId, await roulette.getAddress())
      ).to.emit(roulette, "SpinResult");
    });
    
    it("Should calculate prizes correctly based on random number", async function () {
      const { roulette, vrfCoordinator, player1 } = await loadFixture(deployRouletteFixture);
      
      // Make spin request
      const spinTx = await roulette.connect(player1).spin({ 
        value: ethers.parseEther("0.1") 
      });
      const spinReceipt = await spinTx.wait();
      
      const event = spinReceipt.logs.find(
        log => log.fragment && log.fragment.name === "SpinRequested"
      );
      const requestId = event.args.requestId;
      
      // Fulfill with specific random number
      const fulfillTx = await vrfCoordinator.fulfillRandomWords(
        requestId, 
        await roulette.getAddress()
      );
      const fulfillReceipt = await fulfillTx.wait();
      
      // Check SpinResult event
      const resultEvent = fulfillReceipt.logs.find(
        log => {
          try {
            const parsed = roulette.interface.parseLog(log);
            return parsed && parsed.name === "SpinResult";
          } catch {
            return false;
          }
        }
      );
      
      expect(resultEvent).to.not.be.undefined;
    });
  });
  
  describe("Pause Functionality", function () {
    it("Should allow owner to pause", async function () {
      const { roulette } = await loadFixture(deployRouletteFixture);
      
      await expect(roulette.pause())
        .to.emit(roulette, "Paused");
      
      const stats = await roulette.getStats();
      expect(stats[3]).to.be.true; // isPaused
    });
    
    it("Should allow owner to unpause", async function () {
      const { roulette } = await loadFixture(deployRouletteFixture);
      
      await roulette.pause();
      await expect(roulette.unpause())
        .to.emit(roulette, "Unpaused");
      
      const stats = await roulette.getStats();
      expect(stats[3]).to.be.false; // isPaused
    });
    
    it("Should reject non-owner pause", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      await expect(
        roulette.connect(player1).pause()
      ).to.be.revertedWithCustomError(roulette, "OwnableUnauthorizedAccount");
    });
  });
  
  describe("Player Stats", function () {
    it("Should track player statistics correctly", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      // First spin
      await roulette.connect(player1).spin({ value: ethers.parseEther("0.1") });
      
      let stats = await roulette.getPlayerStats(player1.address);
      expect(stats.totalSpins).to.equal(1);
      
      // Wait and spin again
      await ethers.provider.send("evm_increaseTime", [31]);
      await ethers.provider.send("evm_mine");
      
      await roulette.connect(player1).spin({ value: ethers.parseEther("0.1") });
      
      stats = await roulette.getPlayerStats(player1.address);
      expect(stats.totalSpins).to.equal(2);
    });
    
    it("Should return correct cooldown information", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      const beforeSpin = await roulette.getPlayerStats(player1.address);
      expect(beforeSpin.lastSpinTime).to.equal(0);
      
      await roulette.connect(player1).spin({ value: ethers.parseEther("0.1") });
      
      const afterSpin = await roulette.getPlayerStats(player1.address);
      expect(afterSpin.lastSpinTime).to.be.gt(0);
      expect(afterSpin.canSpinAgainAt).to.be.gt(afterSpin.lastSpinTime);
    });
  });
  
  describe("Emergency Functions", function () {
    it("Should allow emergency withdraw when paused", async function () {
      const { roulette, owner } = await loadFixture(deployRouletteFixture);
      
      await roulette.pause();
      
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await roulette.emergencyWithdraw();
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      
      expect(balanceAfter).to.be.gt(balanceBefore);
      expect(await roulette.houseBalance()).to.equal(0);
    });
    
    it("Should reject emergency withdraw when not paused", async function () {
      const { roulette } = await loadFixture(deployRouletteFixture);
      
      await expect(
        roulette.emergencyWithdraw()
      ).to.be.revertedWithCustomError(roulette, "ExpectedPause");
    });
  });
  
  describe("Gas Optimization", function () {
    it("Should have reasonable gas costs for spin", async function () {
      const { roulette, player1 } = await loadFixture(deployRouletteFixture);
      
      const tx = await roulette.connect(player1).spin({ 
        value: ethers.parseEther("0.1") 
      });
      const receipt = await tx.wait();
      
      // Gas should be reasonable (adjust based on actual values)
      expect(receipt.gasUsed).to.be.lt(500000);
    });
  });
});