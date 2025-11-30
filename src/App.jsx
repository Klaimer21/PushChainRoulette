import React, { useState, useEffect, useCallback } from 'react';

// Push Chain SDK Imports
import {
  PushUniversalWalletProvider,
  PushUniversalAccountButton,
  usePushWalletContext,
  usePushChainClient,
  usePushChain,
  PushUI,
} from '@pushchain/ui-kit';

const SPIN_COST = 0.1;

// ⚠️ REPLACE WITH YOUR DEPLOYED CONTRACT ADDRESS
const CONTRACT_ADDRESS = '0xda2428f678902607e0360AD630266AFde96e4F30';

// Contract ABI
const ROULETTE_ABI = [
  {
    "inputs": [],
    "name": "quickSpin",
    "outputs": [{"internalType": "uint256", "name": "prize", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getStats",
    "outputs": [
      {"internalType": "uint256", "name": "contractBalance", "type": "uint256"},
      {"internalType": "uint256", "name": "availableBalance", "type": "uint256"},
      {"internalType": "uint256", "name": "spinCost", "type": "uint256"},
      {"internalType": "bool", "name": "isPaused", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
    "name": "getPlayerStats",
    "outputs": [
      {"internalType": "uint256", "name": "totalSpins", "type": "uint256"},
      {"internalType": "uint256", "name": "totalWins", "type": "uint256"},
      {"internalType": "uint256", "name": "lastSpinTime", "type": "uint256"},
      {"internalType": "uint256", "name": "canSpinAgainAt", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "player", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "betAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "prizeAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "randomNumber", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "SpinRevealed",
    "type": "event"
  }
];

const PRIZES = [
  { amount: 0, probability: 60, label: 'Try Again', gradient: ['#4B5563', '#374151'] },
  { amount: 0.05, probability: 30, label: '0.05 PC', gradient: ['#3B82F6', '#2563EB'] },
  { amount: 0.1, probability: 5, label: '0.1 PC', gradient: ['#10B981', '#059669'] },
  { amount: 0.2, probability: 3, label: '0.2 PC', gradient: ['#F59E0B', '#D97706'] },
  { amount: 0.5, probability: 1.5, label: '0.5 PC', gradient: ['#F97316', '#EA580C'] },
  { amount: 1, probability: 0.5, label: '1 PC', gradient: ['#9333EA', '#7C3AED'] }
];

// Roulette Wheel Component
const RouletteWheel = ({ isSpinning }) => {
  const [rotation, setRotation] = useState(0);
  const segmentAngle = 360 / PRIZES.length;
  
  useEffect(() => {
    if (isSpinning) {
      setRotation(prev => prev + 360 * 8 + Math.random() * 360);
    }
  }, [isSpinning]);
  
  return (
    <div className="relative w-96 h-96 mx-auto">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-30 blur-2xl animate-pulse" />
      
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 shadow-2xl flex items-center justify-center border-8 border-purple-500/30">
        <div 
          className="w-80 h-80 rounded-full relative"
          style={{ 
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
          }}
        >
          {PRIZES.map((prize, index) => {
            const startAngle = (segmentAngle * index - 90) * (Math.PI / 180);
            const endAngle = (segmentAngle * (index + 1) - 90) * (Math.PI / 180);
            const x1 = 160 + 160 * Math.cos(startAngle);
            const y1 = 160 + 160 * Math.sin(startAngle);
            const x2 = 160 + 160 * Math.cos(endAngle);
            const y2 = 160 + 160 * Math.sin(endAngle);
            const pathData = `M 160 160 L ${x1} ${y1} A 160 160 0 ${segmentAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
            const midAngle = (segmentAngle * index + segmentAngle / 2 - 90) * (Math.PI / 180);
            const textX = 160 + 110 * Math.cos(midAngle);
            const textY = 160 + 110 * Math.sin(midAngle);
            
            return (
              <svg key={index} className="absolute inset-0" viewBox="0 0 320 320">
                <defs>
                  <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={prize.gradient[0]} />
                    <stop offset="100%" stopColor={prize.gradient[1]} />
                  </linearGradient>
                </defs>
                <path d={pathData} fill={`url(#gradient-${index})`} stroke="#1F2937" strokeWidth="2" />
                <text x={textX} y={textY} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="bold"
                  style={{ transform: `rotate(${segmentAngle * index + segmentAngle / 2}deg)`, transformOrigin: '160px 160px' }}>
                  {prize.label}
                </text>
              </svg>
            );
          })}
          <svg className="absolute inset-0" viewBox="0 0 320 320">
            <circle cx="160" cy="160" r="155" fill="none" stroke="#1F2937" strokeWidth="3" />
            <circle cx="160" cy="160" r="50" fill="none" stroke="#1F2937" strokeWidth="3" />
          </svg>
        </div>
        
        <div className="absolute w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-xl flex items-center justify-center border-4 border-gray-900">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-3xl">
            🎰
          </div>
        </div>
      </div>
      
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
        <div className="w-6 h-8 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-b-full shadow-lg" 
             style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
      </div>
    </div>
  );
};

// Main Game Component
const RouletteGame = () => {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient, isInitialized } = usePushChainClient();
  const { PushChain } = usePushChain();
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentPrize, setCurrentPrize] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [balance, setBalance] = useState('0');
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;

  // Fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (isConnected && pushChainClient && isInitialized) {
        try {
          const { ethers } = await import('https://cdn.jsdelivr.net/npm/ethers@6.7.0/+esm');
          const provider = new ethers.JsonRpcProvider('https://rpc.testnet.push.org');
          const ueaAddress = pushChainClient.universal.account;
          const balanceWei = await provider.getBalance(ueaAddress);
          const balancePC = PushChain.utils.helpers.formatUnits(balanceWei.toString(), 18);
          setBalance(balancePC);
        } catch (err) {
          console.error('Balance fetch error:', err);
        }
      }
    };
    
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [isConnected, pushChainClient, isInitialized, PushChain]);

  const selectPrize = () => {
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const prize of PRIZES) {
      cumulative += prize.probability;
      if (random <= cumulative) return prize;
    }
    return PRIZES[0];
  };

  const handleSpin = async () => {
    if (isSpinning || !isConnected || !pushChainClient || !isInitialized) return;
    
    if (parseFloat(balance) < SPIN_COST) {
      setError('Insufficient balance! You need at least 0.1 PC to spin.');
      return;
    }

    setIsSpinning(true);
    setShowResult(false);
    setCurrentPrize(null);
    setError(null);

    try {
      const spinData = PushChain.utils.helpers.encodeTxData({
        abi: ROULETTE_ABI,
        functionName: 'quickSpin',
        args: []
      });
      
      const txResponse = await pushChainClient.universal.sendTransaction({
        to: CONTRACT_ADDRESS,
        value: PushChain.utils.helpers.parseUnits(SPIN_COST.toString(), 18),
        data: spinData
      });

      const txReceipt = await txResponse.wait(1);
      
      let prizeAmount = 0;
      try {
        const ethers = await import('https://cdn.jsdelivr.net/npm/ethers@6.7.0/+esm');
        const iface = new ethers.Interface(ROULETTE_ABI);
        for (const log of txReceipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === 'SpinRevealed') {
              prizeAmount = parseFloat(PushChain.utils.helpers.formatUnits(parsed.args.prizeAmount.toString(), 18));
              break;
            }
          } catch (e) { continue; }
        }
      } catch (parseError) {
        const prize = selectPrize();
        prizeAmount = prize.amount;
      }
      
      const prize = PRIZES.find(p => Math.abs(p.amount - prizeAmount) < 0.001) || PRIZES[0];

      setTimeout(() => {
        setCurrentPrize(prize);
        setIsSpinning(false);
        setShowResult(true);
        setTotalSpins(prev => prev + 1);
        if (prize.amount > 0) {
          setTotalWins(prev => prev + prize.amount);
        }
        setHistory(prev => [{ prize, timestamp: new Date().toLocaleTimeString(), txHash: txResponse.hash }, ...prev.slice(0, 9)]);
      }, 5000);

    } catch (err) {
      console.error('Transaction failed:', err);
      setIsSpinning(false);
      setError(err.message || 'Transaction failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <header className="border-b border-purple-800/30 backdrop-blur-sm bg-gray-900/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-2xl">
              🎰
            </div>
            <div>
              <h1 className="text-2xl font-bold">Push Chain Roulette</h1>
              <p className="text-xs text-gray-400">Testnet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isConnected && isInitialized && pushChainClient && (
              <div className="text-right hidden md:block">
                <div className="text-sm text-gray-400">Balance</div>
                <div className="text-xl font-bold">{balance} PC</div>
              </div>
            )}
            <PushUniversalAccountButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 border border-purple-800/30">
              <div className="text-6xl mb-6">🎰</div>
              <h2 className="text-3xl font-bold mb-4">Connect Your Wallet</h2>
              <p className="text-gray-400 mb-8">
                Connect your wallet to start playing Push Chain Roulette. 
                Support for EVM, Solana, and email login.
              </p>
              <div className="text-yellow-400 mb-6">
                1 spin = 0.1 PC • Win up to 1 PC!
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-purple-800/30">
                <RouletteWheel isSpinning={isSpinning} />
                
                {showResult && currentPrize && (
                  <div className="mt-6 text-center">
                    <div className={`inline-block px-6 py-3 rounded-xl ${
                      currentPrize.amount > 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-700'
                    }`}>
                      {currentPrize.amount > 0 ? (
                        <div>
                          <div className="text-2xl font-bold">🎉 Congratulations!</div>
                          <div className="text-3xl font-bold mt-1">+{currentPrize.amount} PC</div>
                        </div>
                      ) : (
                        <div className="text-xl font-bold">Better luck next time!</div>
                      )}
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="mt-6 bg-red-500/20 border border-red-500 rounded-lg p-4 text-center text-red-400">
                    {error}
                  </div>
                )}
                
                <div className="mt-8 text-center">
                  <button
                    onClick={handleSpin}
                    disabled={isSpinning || !isInitialized}
                    className={`px-12 py-4 rounded-xl font-bold text-xl transition-all ${
                      isSpinning || !isInitialized
                        ? 'bg-gray-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50 hover:scale-105'
                    }`}
                  >
                    {isSpinning ? 'Spinning...' : `Spin (${SPIN_COST} PC)`}
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-800/30">
                <h3 className="text-xl font-bold mb-4">Prize Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PRIZES.map((prize, index) => (
                    <div key={index} style={{ background: `linear-gradient(135deg, ${prize.gradient[0]}, ${prize.gradient[1]})` }} 
                         className="rounded-lg p-3 hover:scale-105 transition-transform">
                      <div className="font-bold">{prize.label}</div>
                      <div className="text-sm opacity-90">{prize.probability}% chance</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-800/30">
                <h3 className="text-xl font-bold mb-4">Your Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Balance</span>
                    <span className="font-bold text-xl text-purple-400">{balance} PC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Spins</span>
                    <span className="font-bold text-xl">{totalSpins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Wins</span>
                    <span className="font-bold text-xl text-green-400">{totalWins.toFixed(2)} PC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Net P/L</span>
                    <span className={`font-bold text-xl ${
                      totalWins - totalSpins * SPIN_COST >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {(totalWins - totalSpins * SPIN_COST).toFixed(2)} PC
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-800/30">
                <h3 className="text-xl font-bold mb-4">Recent Spins</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-5xl mb-2">🎰</div>
                      <p>No spins yet.</p>
                      <p className="text-sm">Try your luck!</p>
                    </div>
                  ) : (
                    history.map((item, index) => (
                      <div key={index} className="bg-gray-700/50 rounded-lg p-3 hover:bg-gray-700 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${item.prize.amount > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                            {item.prize.amount > 0 ? `+${item.prize.amount} PC` : 'No win'}
                          </span>
                          <span className="text-xs text-gray-400">{item.timestamp}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">{item.txHash}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 border-t border-purple-800/30 py-6">
        <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
          <p>Push Chain Testnet • Powered by Push Protocol • Play Responsibly</p>
        </div>
      </footer>
    </div>
  );
};

// App Root Component
function App() {
  const walletConfig = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    login: {
      email: true,
      google: true,
      wallet: { enabled: true }
    }
  };

  const appMetadata = {
    logoUrl: 'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=400',
    title: 'Push Chain Roulette',
    description: 'Spin to win PC tokens on Push Chain Testnet'
  };

  return (
    <PushUniversalWalletProvider config={walletConfig} app={appMetadata} themeMode="dark">
      <RouletteGame />
    </PushUniversalWalletProvider>
  );
}

export default App;