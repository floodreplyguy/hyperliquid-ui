'use client';

import { useEffect, useState } from 'react';

interface WhaleTrade {
  symbol: string;
  notional: number;
  price: number;
  dir: 'A' | 'B';
  wallet: string;
  timestamp: number;
}

export default function WhaleWatcher() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [connected, setConnected] = useState(false);
  const [threshold, setThreshold] = useState(50000);
  const [assetFilter, setAssetFilter] = useState('ALL');

  useEffect(() => {
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
      ['BTC', 'ETH', 'SOL', 'HYPE'].forEach(coin =>
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }))
      );
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.channel !== 'trades') return;

        const fresh = (msg.data as any[])
          .filter(f => +f.sz * +f.px >= threshold)
          .map(f => ({
            symbol: f.coin,
            notional: +f.sz * +f.px,
            price: +f.px,
            dir: f.side === 'A' ? 'A' : 'B',
            wallet: f.users?.[0] ?? 'unknown',
            timestamp: f.time ?? Date.now(),
          })) as WhaleTrade[];

        if (fresh.length > 0) {
          setTrades(prev => [...fresh, ...prev].slice(0, 50));
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, [threshold]);

  const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white overflow-hidden">
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.6); }
        }
        @keyframes slide-in {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes glow-buy {
          0%, 100% { box-shadow: 0 0 15px rgba(34, 197, 94, 0.2); }
          50% { box-shadow: 0 0 25px rgba(34, 197, 94, 0.5); }
        }
        @keyframes glow-sell {
          0%, 100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.5); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .whale-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .trade-enter {
          animation: slide-in 0.5s ease-out;
        }
        .buy-glow {
          animation: glow-buy 2s ease-in-out infinite;
        }
        .sell-glow {
          animation: glow-sell 2s ease-in-out infinite;
        }
        .whale-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 p-4 whale-glow">
        <div className="flex justify-between items-center text-sm font-semibold mb-3">
          <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            WHALE RADAR
          </span>
          <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
            connected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-500 shadow-lg shadow-red-500/50'
          }`} />
        </div>

        <div className="flex items-center gap-2 text-xs mb-3 text-gray-300">
          <span className="text-blue-400">$50K</span>
          <input
            type="range"
            min={50_000}
            max={1_000_000}
            step={25_000}
            value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="flex-1 h-2 bg-gray-700 rounded-lg cursor-pointer accent-blue-500 transition-all duration-300 hover:bg-gray-600"
          />
          <span className="text-purple-400">$1M</span>
        </div>

        <select
          value={assetFilter}
          onChange={e => setAssetFilter(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 text-white text-xs p-2 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-300 hover:bg-gray-700"
        >
          <option value="ALL">All Assets</option>
          {['BTC', 'ETH', 'SOL', 'HYPE'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto">
        {trades.filter(t => assetFilter === 'ALL' || t.symbol === assetFilter).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-center px-4">
            <div className="whale-float">
              <div className="text-4xl mb-3">🐋</div>
              <div className="text-sm">
                {connected ? 'Scanning the depths...' : 'Connecting to the ocean...'}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {trades.filter(t => assetFilter === 'ALL' || t.symbol === assetFilter).map((t, i) => {
              const isBuy = t.dir === 'B';
              const isLarge = t.notional > 200000;

              return (
                <div
                  key={`${t.timestamp}-${i}`}
                  className={`trade-enter flex items-center p-3 rounded-lg transition-all duration-500 hover:scale-[1.02] transform ${
                    isBuy 
                      ? `bg-gradient-to-r from-green-900/20 to-green-800/10 border-l-4 border-green-500 hover:from-green-800/30 hover:to-green-700/20 ${isLarge ? 'buy-glow' : ''}` 
                      : `bg-gradient-to-r from-red-900/20 to-red-800/10 border-l-4 border-red-500 hover:from-red-800/30 hover:to-red-700/20 ${isLarge ? 'sell-glow' : ''}`
                  }`}
                >
                  <div className="flex-1">
                    <div className={`font-bold text-lg tracking-wider transition-all duration-300 ${
                      isBuy ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.symbol}
                      {isLarge && (
                        <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded-full animate-pulse">
                          WHALE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 leading-tight">
                      {usd(t.notional)} @ ${t.price.toLocaleString()}
                    </div>
                    <div className={`text-xs font-bold mt-1 transition-all duration-300 ${
                      isBuy ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {isBuy ? '🟢 BUY' : '🔴 SELL'}
                    </div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(t.wallet)}
                    className="ml-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-blue-600 hover:to-blue-500 text-white text-xs px-3 py-2 rounded-lg border border-gray-600 transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                    title="Copy wallet address"
                  >
                    📋
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
