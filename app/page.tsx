'use client';

import { useState } from 'react';

interface WalletData {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  realizedPnl: number;
  volume: number;
  fees: number;
  avgNotional: number;
  mostTraded: string;
  longs: {
    trades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalPnl: number;
    volume: number;
    fees: number;
    top3: Record<string, number>;
  };
  shorts: {
    trades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalPnl: number;
    volume: number;
    fees: number;
    top3: Record<string, number>;
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
      const response = await fetch(`/stats?wallet=${walletAddress}&type=${tradeType}`);

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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Hyperliquid Trading Analytics</h1>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter wallet address"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trade Type
              </label>
              <select
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value as 'perp' | 'spot')}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="perp">Perpetuals</option>
                <option value="spot">Spot</option>
              </select>
            </div>
            <button
              onClick={fetchWalletData}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors"
            >
              {loading ? 'Loading...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            Error: {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Total Trades</h3>
                <p className="text-3xl font-bold text-blue-600">{data.totalTrades}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Win Rate</h3>
                <p className="text-3xl font-bold text-green-600">{formatPercentage(data.winRate)}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Realized PnL</h3>
                <p className={`text-3xl font-bold ${data.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.realizedPnl)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Total Volume</h3>
                <p className="text-3xl font-bold text-purple-600">{formatCurrency(data.volume)}</p>
              </div>
            </div>

            {/* Long vs Short Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4 text-green-600">Long Positions</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Trades:</span>
                    <span className="font-semibold">{data.longs.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <span className="font-semibold">{formatPercentage(data.longs.winRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total PnL:</span>
                    <span className={`font-semibold ${data.longs.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(data.longs.totalPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume:</span>
                    <span className="font-semibold">{formatCurrency(data.longs.volume)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4 text-red-600">Short Positions</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Trades:</span>
                    <span className="font-semibold">{data.shorts.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <span className="font-semibold">{formatPercentage(data.shorts.winRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total PnL:</span>
                    <span className={`font-semibold ${data.shorts.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(data.shorts.totalPnl)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume:</span>
                    <span className="font-semibold">{formatCurrency(data.shorts.volume)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-3">Biggest Winner</h3>
                <p className="font-medium">{data.biggestWinner.symbol}</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(data.biggestWinner.pnl)}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-3">Biggest Loser</h3>
                <p className="font-medium">{data.biggestLoser.symbol}</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(data.biggestLoser.pnl)}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-3">Most Traded</h3>
                <p className="text-2xl font-bold text-blue-600">{data.mostTraded}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
