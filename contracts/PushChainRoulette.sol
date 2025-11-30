// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PushChainRoulette - Testnet Version
 * @dev Provably fair roulette game on Push Chain for testnet (no Chainlink VRF fees)
 * @notice Uses block.prevrandao + commit-reveal for randomness
 * 
 * Prize distribution:
 * - 60% chance: No win (0 PC)
 * - 30% chance: 0.05 PC
 * - 5% chance: 0.1 PC
 * - 3% chance: 0.2 PC
 * - 1.5% chance: 0.5 PC
 * - 0.5% chance: 1 PC
 * 
 * Security features:
 * - Commit-reveal pattern for randomness
 * - Rate limiting per player
 * - Pausable in emergency
 * - Reentrancy protection
 * - Owner access control
 * 
 * TESTNET ONLY: This randomness is suitable for testnet with no real funds.
 * For production with real money, integrate Chainlink VRF.
 */
contract PushChainRoulette is Ownable, ReentrancyGuard, Pausable {
    
    // ========== Game Configuration ==========
    uint256 public constant SPIN_COST = 0.1 ether; // 0.1 PC
    uint256 public constant COOLDOWN_PERIOD = 30 seconds; // Rate limiting
    uint256 public constant MAX_PRIZE = 1 ether; // Maximum prize: 1 PC
    uint256 public constant REVEAL_DELAY = 2; // Blocks to wait before reveal
    
    // Prize tiers (in wei / uPC)
    uint256 private constant PRIZE_0 = 0;
    uint256 private constant PRIZE_1 = 0.05 ether;
    uint256 private constant PRIZE_2 = 0.1 ether;
    uint256 private constant PRIZE_3 = 0.2 ether;
    uint256 private constant PRIZE_4 = 0.5 ether;
    uint256 private constant PRIZE_5 = 1 ether;
    
    // ========== State Variables ==========
    uint256 public houseBalance;
    uint256 private nonce; // Internal nonce for additional entropy
    
    // Commit-Reveal Storage
    struct SpinCommit {
        bytes32 commitHash;
        uint256 blockNumber;
        uint256 betAmount;
        bool revealed;
    }
    
    mapping(address => SpinCommit) private commits;
    
    // Rate limiting: player address => last spin timestamp
    mapping(address => uint256) private s_lastSpinTime;
    
    // Player statistics
    mapping(address => uint256) public playerTotalSpins;
    mapping(address => uint256) public playerTotalWins;
    
    // ========== Events ==========
    event SpinCommitted(
        address indexed player,
        bytes32 commitHash,
        uint256 blockNumber,
        uint256 timestamp
    );
    
    event SpinRevealed(
        address indexed player,
        uint256 betAmount,
        uint256 prizeAmount,
        uint256 randomNumber,
        uint256 timestamp
    );
    
    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    
    // ========== Errors ==========
    error InsufficientHouseBalance(uint256 required, uint256 available);
    error IncorrectBetAmount(uint256 sent, uint256 required);
    error CooldownNotExpired(uint256 timeRemaining);
    error NoCommitFound();
    error CommitAlreadyRevealed();
    error RevealTooEarly(uint256 blocksRemaining);
    error TransferFailed();

    /**
     * @notice Constructor initializes the contract
     */
    constructor() Ownable(msg.sender) {}
    
    // ========== External Functions ==========
    
    /**
     * @notice Deposit funds to the house balance (owner only)
     * @dev Adds PC to the contract's bankroll for paying out prizes
     */
    function depositFunds() external payable onlyOwner {
        require(msg.value > 0, "Must send some PC");
        houseBalance += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw funds from the house balance (owner only)
     * @param amount Amount of PC to withdraw
     */
    function withdrawFunds(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= houseBalance, "Insufficient balance");
        houseBalance -= amount;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FundsWithdrawn(owner(), amount);
    }
    
    /**
     * @notice Step 1: Commit to a spin
     * @dev Player commits with a random secret, preventing front-running
     * @param secretHash Hash of player's secret (keccak256(abi.encodePacked(secret)))
     */
    function commitSpin(bytes32 secretHash) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        returns (bytes32 commitHash) 
    {
        // Validate bet amount
        if (msg.value != SPIN_COST) {
            revert IncorrectBetAmount(msg.value, SPIN_COST);
        }
        
        // Check house balance can cover max prize
        if (houseBalance < MAX_PRIZE) {
            revert InsufficientHouseBalance(MAX_PRIZE, houseBalance);
        }
        
        // Rate limiting check
        uint256 lastSpin = s_lastSpinTime[msg.sender];
        if (block.timestamp < lastSpin + COOLDOWN_PERIOD) {
            revert CooldownNotExpired((lastSpin + COOLDOWN_PERIOD) - block.timestamp);
        }
        
        // Check no pending commit
        require(
            commits[msg.sender].revealed || commits[msg.sender].blockNumber == 0,
            "Previous spin not revealed"
        );
        
        // Add bet to house balance
        houseBalance += msg.value;
        
        // Update last spin time
        s_lastSpinTime[msg.sender] = block.timestamp;
        
        // Create commit hash combining user secret with contract state
        commitHash = keccak256(abi.encodePacked(
            secretHash,
            msg.sender,
            block.timestamp,
            nonce++
        ));
        
        // Store commit
        commits[msg.sender] = SpinCommit({
            commitHash: commitHash,
            blockNumber: block.number,
            betAmount: msg.value,
            revealed: false
        });
        
        emit SpinCommitted(msg.sender, commitHash, block.number, block.timestamp);
        
        return commitHash;
    }
    
    /**
     * @notice Step 2: Reveal the spin result
     * @dev Must wait REVEAL_DELAY blocks to prevent same-block manipulation
     * @param secret The secret used in commitSpin
     */
    function revealSpin(uint256 secret) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256 prize) 
    {
        SpinCommit storage commit = commits[msg.sender];
        
        // Validate commit exists
        if (commit.blockNumber == 0) {
            revert NoCommitFound();
        }
        
        // Validate not already revealed
        if (commit.revealed) {
            revert CommitAlreadyRevealed();
        }
        
        // Validate reveal delay
        if (block.number < commit.blockNumber + REVEAL_DELAY) {
            revert RevealTooEarly((commit.blockNumber + REVEAL_DELAY) - block.number);
        }
        
        // Verify secret matches commit
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        bytes32 expectedCommit = keccak256(abi.encodePacked(
            secretHash,
            msg.sender,
            s_lastSpinTime[msg.sender],
            nonce - 1 // Use the nonce from commit time
        ));
        
        require(expectedCommit == commit.commitHash, "Invalid secret");
        
        // Mark as revealed
        commit.revealed = true;
        
        // Generate random number using multiple entropy sources
        uint256 randomNumber = _generateRandomNumber(secret, commit.blockNumber);
        
        // Calculate prize
        prize = _calculatePrize(randomNumber);
        
        // Pay out prize if any
        if (prize > 0) {
            require(houseBalance >= prize, "Insufficient house balance");
            houseBalance -= prize;
            playerTotalWins[msg.sender] += prize;
            
            (bool success, ) = payable(msg.sender).call{value: prize}("");
            if (!success) {
                // If transfer fails, add prize back to house balance
                houseBalance += prize;
                playerTotalWins[msg.sender] -= prize;
            }
        }
        
        // Update stats
        playerTotalSpins[msg.sender]++;
        
        emit SpinRevealed(
            msg.sender,
            commit.betAmount,
            prize,
            randomNumber,
            block.timestamp
        );
        
        return prize;
    }
    
    /**
     * @notice Quick spin for instant play (less secure but faster)
     * @dev Combines commit and reveal in one transaction
     * WARNING: Less secure than commit-reveal, use only for testnet
     */
    function quickSpin() 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        returns (uint256 prize) 
    {
        // Validate bet amount
        if (msg.value != SPIN_COST) {
            revert IncorrectBetAmount(msg.value, SPIN_COST);
        }
        
        // Check house balance
        if (houseBalance < MAX_PRIZE) {
            revert InsufficientHouseBalance(MAX_PRIZE, houseBalance);
        }
        
        // Rate limiting
        uint256 lastSpin = s_lastSpinTime[msg.sender];
        if (block.timestamp < lastSpin + COOLDOWN_PERIOD) {
            revert CooldownNotExpired((lastSpin + COOLDOWN_PERIOD) - block.timestamp);
        }
        
        // Add bet to house balance
        houseBalance += msg.value;
        
        // Update last spin time
        s_lastSpinTime[msg.sender] = block.timestamp;
        
        // Generate random number (less secure but instant)
        uint256 randomNumber = _generateQuickRandomNumber();
        
        // Calculate prize
        prize = _calculatePrize(randomNumber);
        
        // Pay out prize
        if (prize > 0) {
            require(houseBalance >= prize, "Insufficient house balance");
            houseBalance -= prize;
            playerTotalWins[msg.sender] += prize;
            
            (bool success, ) = payable(msg.sender).call{value: prize}("");
            if (!success) {
                houseBalance += prize;
                playerTotalWins[msg.sender] -= prize;
            }
        }
        
        // Update stats
        playerTotalSpins[msg.sender]++;
        
        emit SpinRevealed(
            msg.sender,
            msg.value,
            prize,
            randomNumber,
            block.timestamp
        );
        
        return prize;
    }
    
    /**
     * @notice Pause the contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Get contract statistics
     */
    function getStats() external view returns (
        uint256 contractBalance,
        uint256 availableBalance,
        uint256 spinCost,
        bool isPaused
    ) {
        return (
            address(this).balance,
            houseBalance,
            SPIN_COST,
            paused()
        );
    }
    
    /**
     * @notice Get player statistics
     */
    function getPlayerStats(address player) external view returns (
        uint256 totalSpins,
        uint256 totalWins,
        uint256 lastSpinTime,
        uint256 canSpinAgainAt
    ) {
        uint256 lastSpin = s_lastSpinTime[player];
        uint256 canSpinAt = lastSpin + COOLDOWN_PERIOD;
        
        return (
            playerTotalSpins[player],
            playerTotalWins[player],
            lastSpin,
            canSpinAt > block.timestamp ? canSpinAt : block.timestamp
        );
    }
    
    /**
     * @notice Check if player has pending commit
     */
    function hasPendingCommit(address player) external view returns (bool) {
        SpinCommit storage commit = commits[player];
        return commit.blockNumber > 0 && !commit.revealed;
    }
    
    /**
     * @notice Get commit details
     */
    function getCommitDetails(address player) external view returns (
        bytes32 commitHash,
        uint256 blockNumber,
        uint256 betAmount,
        bool revealed,
        bool canReveal
    ) {
        SpinCommit storage commit = commits[player];
        return (
            commit.commitHash,
            commit.blockNumber,
            commit.betAmount,
            commit.revealed,
            block.number >= commit.blockNumber + REVEAL_DELAY
        );
    }
    
    /**
     * @notice Emergency withdraw (owner only, when paused)
     */
    function emergencyWithdraw() external onlyOwner whenPaused nonReentrant {
        uint256 balance = address(this).balance;
        houseBalance = 0;
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit FundsWithdrawn(owner(), balance);
    }
    
    // ========== Internal Functions ==========
    
    /**
     * @notice Generate random number using commit-reveal pattern
     * @dev Combines multiple entropy sources for better randomness
     */
    function _generateRandomNumber(uint256 secret, uint256 commitBlock) 
        private 
        view 
        returns (uint256) 
    {
        return uint256(keccak256(abi.encodePacked(
            secret,
            block.prevrandao,        // New random source in post-merge Ethereum
            blockhash(commitBlock),  // Block hash from commit time
            block.timestamp,
            msg.sender,
            nonce,
            address(this).balance
        ))) % 1000;
    }
    
    /**
     * @notice Generate quick random number (less secure)
     * @dev For instant spins, combines available entropy sources
     */
    function _generateQuickRandomNumber() private returns (uint256) {
        nonce++;
        return uint256(keccak256(abi.encodePacked(
            block.prevrandao,
            block.timestamp,
            msg.sender,
            nonce,
            blockhash(block.number - 1),
            address(this).balance
        ))) % 1000;
    }
    
    /**
     * @notice Calculate prize based on random number
     * @dev Distribution:
     * 0-599 (60%): No win
     * 600-899 (30%): 0.05 PC
     * 900-949 (5%): 0.1 PC
     * 950-979 (3%): 0.2 PC
     * 980-994 (1.5%): 0.5 PC
     * 995-999 (0.5%): 1 PC
     */
    function _calculatePrize(uint256 randomNumber) 
        private 
        pure 
        returns (uint256) 
    {
        if (randomNumber < 600) {
            return PRIZE_0; // 60%
        } else if (randomNumber < 900) {
            return PRIZE_1; // 30%
        } else if (randomNumber < 950) {
            return PRIZE_2; // 5%
        } else if (randomNumber < 980) {
            return PRIZE_3; // 3%
        } else if (randomNumber < 995) {
            return PRIZE_4; // 1.5%
        } else {
            return PRIZE_5; // 0.5%
        }
    }
    
    // ========== Receive Functions ==========
    
    receive() external payable {
        houseBalance += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    fallback() external payable {
        houseBalance += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
}