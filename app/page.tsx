'use client';

import { useState } from 'react';

interface WalletData {
  overall: {
    totalTrades: number;
    winRatePercent: number;
    avgWin: number;
    avgLoss: number;
    totalPnl: number;
    totalVolume: number;
    feesPaid: number;
    currentStreak: number;
    timeStart: string;
    timeEnd: string;
  };
  longs: {
    trades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalPnl: number;
    volume: number;
    fees: number;
  };
  shorts: {
    trades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalPnl: number;
    volume: number;
    fees: number;
  };
  biggestOrders: Array<{ symbol: string; notional: number }>;
  biggestWinner: { symbol: string; pnl: number };
  biggestLoser: { symbol: string; pnl: number };
  pnlChart: Array<{ trade: number; pnl: number }>;
}

export default function TradingAnalytics() {
  const [walletAddress, setWalletAddress] = useState('');
  const [tradeType, setTradeType] = useState<'perp' | 'spot'>('perp');
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWalletData = async () => {
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const spot = tradeType === 'spot';
      // Use the Flask server directly for API calls
      const response = await fetch(`http://0.0.0.0:5000/api/wallet/${walletAddress}?spot=${spot}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStreakDisplay = (streak: number) => {
    if (streak === 0) return { text: "No Streak", color: "text-gray-400" };
    const isWin = streak > 0;
    return {
      text: `${Math.abs(streak)} ${isWin ? 'WIN' : 'LOSS'} STREAK`,
      color: isWin ? "text-green-400" : "text-red-400"
    };
  };

  const getPnlColor = (pnl: number) => {
    return pnl >= 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-black to-red-500/20"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,140,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,140,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-orange-600 bg-clip-text text-transparent mb-2">
            MISSION DEBRIEF
          </h1>
          <p className="text-orange-300 text-xl tracking-wider">HYPERLIQUID COMBAT ANALYTICS</p>
          <div className="mt-4 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
        </div>

        {/* Input Section */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-orange-500/30 rounded-lg p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-orange-300 text-sm font-semibold mb-2 tracking-wide">
                  TARGET WALLET ADDRESS
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-black border border-orange-500/50 rounded px-4 py-3 text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-orange-300 text-sm font-semibold mb-2 tracking-wide">
                  OPERATION TYPE
                </label>
                <select
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value as 'perp' | 'spot')}
                  className="bg-black border border-orange-500/50 rounded px-4 py-3 text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
                >
                  <option value="perp">PERPETUALS</option>
                  <option value="spot">SPOT TRADING</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchWalletData}
                  disabled={loading}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-8 rounded transition-all transform hover:scale-105 disabled:transform-none shadow-lg"
                >
                  {loading ? 'ANALYZING...' : 'EXECUTE'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
              <p className="text-red-300">⚠️ MISSION FAILED: {error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-orange-500/30 rounded-lg p-6 text-center">
                <h3 className="text-orange-300 text-sm font-semibold mb-2 tracking-wide">TOTAL OPERATIONS</h3>
                <p className="text-4xl font-bold text-white">{data.overall.totalTrades}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/30 rounded-lg p-6 text-center">
                <h3 className="text-green-300 text-sm font-semibold mb-2 tracking-wide">SUCCESS RATE</h3>
                <p className="text-4xl font-bold text-green-400">{formatPercentage(data.overall.winRatePercent)}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-blue-500/30 rounded-lg p-6 text-center">
                <h3 className="text-blue-300 text-sm font-semibold mb-2 tracking-wide">NET P&L</h3>
                <p className={`text-4xl font-bold ${getPnlColor(data.overall.totalPnl)}`}>
                  {data.overall.totalPnl >= 0 ? '+' : ''}{formatCurrency(data.overall.totalPnl)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/30 rounded-lg p-6 text-center">
                <h3 className="text-purple-300 text-sm font-semibold mb-2 tracking-wide">CURRENT STREAK</h3>
                <p className={`text-3xl font-bold ${getStreakDisplay(data.overall.currentStreak).color}`}>
                  {getStreakDisplay(data.overall.currentStreak).text}
                </p>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Long Positions */}
              <div className="bg-gradient-to-br from-green-900/20 to-gray-900 border border-green-500/30 rounded-lg p-6">
                <h3 className="text-green-300 text-xl font-bold mb-4 tracking-wide">🟢 LONG OPERATIONS</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total Operations:</span>
                    <span className="text-white font-semibold">{data.longs.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Success Rate:</span>
                    <span className="text-green-400 font-semibold">{formatPercentage(data.longs.winRate * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Avg Win:</span>
                    <span className="text-green-400 font-semibold">+{formatCurrency(data.longs.avgWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Avg Loss:</span>
                    <span className="text-red-400 font-semibold">{formatCurrency(data.longs.avgLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total P&L:</span>
                    <span className={`font-semibold ${getPnlColor(data.longs.totalPnl)}`}>
                      {data.longs.totalPnl >= 0 ? '+' : ''}{formatCurrency(data.longs.totalPnl)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Short Positions */}
              <div className="bg-gradient-to-br from-red-900/20 to-gray-900 border border-red-500/30 rounded-lg p-6">
                <h3 className="text-red-300 text-xl font-bold mb-4 tracking-wide">🔴 SHORT OPERATIONS</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total Operations:</span>
                    <span className="text-white font-semibold">{data.shorts.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Success Rate:</span>
                    <span className="text-green-400 font-semibold">{formatPercentage(data.shorts.winRate * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Avg Win:</span>
                    <span className="text-green-400 font-semibold">+{formatCurrency(data.shorts.avgWin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Avg Loss:</span>
                    <span className="text-red-400 font-semibold">{formatCurrency(data.shorts.avgLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Total P&L:</span>
                    <span className={`font-semibold ${getPnlColor(data.shorts.totalPnl)}`}>
                      {data.shorts.totalPnl >= 0 ? '+' : ''}{formatCurrency(data.shorts.totalPnl)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notable Achievements */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-yellow-900/20 to-gray-900 border border-yellow-500/30 rounded-lg p-6">
                <h3 className="text-yellow-300 text-lg font-bold mb-3 tracking-wide">🏆 BIGGEST WIN</h3>
                <p className="text-white font-semibold">{data.biggestWinner.symbol}</p>
                <p className="text-green-400 text-2xl font-bold">+{formatCurrency(data.biggestWinner.pnl)}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-500/30 rounded-lg p-6">
                <h3 className="text-gray-300 text-lg font-bold mb-3 tracking-wide">💀 BIGGEST LOSS</h3>
                <p className="text-white font-semibold">{data.biggestLoser.symbol}</p>
                <p className="text-red-400 text-2xl font-bold">{formatCurrency(data.biggestLoser.pnl)}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-900/20 to-gray-900 border border-blue-500/30 rounded-lg p-6">
                <h3 className="text-blue-300 text-lg font-bold mb-3 tracking-wide">📊 TOTAL VOLUME</h3>
                <p className="text-blue-400 text-2xl font-bold">{formatCurrency(data.overall.totalVolume)}</p>
                <p className="text-gray-400 text-sm mt-1">Fees Paid: {formatCurrency(data.overall.feesPaid)}</p>
              </div>
            </div>

            {/* Mission Period */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-orange-500/30 rounded-lg p-6 text-center">
              <h3 className="text-orange-300 text-lg font-bold mb-2 tracking-wide">MISSION TIMEFRAME</h3>
              <p className="text-white text-xl">
                {data.overall.timeStart} → {data.overall.timeEnd}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
