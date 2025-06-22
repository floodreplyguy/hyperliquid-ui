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
    <div className="fixed top-0 right-0 w-[380px] h-screen overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-black to-gray-900">
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${8 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
        
        {/* Dynamic Wave Background */}
        <div className="absolute inset-0 wave-bg opacity-10" />
      </div>

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 25px rgba(59, 130, 246, 0.4), inset 0 0 15px rgba(59, 130, 246, 0.1); }
          50% { box-shadow: 0 0 35px rgba(59, 130, 246, 0.7), inset 0 0 25px rgba(59, 130, 246, 0.2); }
        }
        
        @keyframes slide-in {
          0% { transform: translateX(100%) rotateY(90deg); opacity: 0; }
          100% { transform: translateX(0) rotateY(0deg); opacity: 1; }
        }
        
        @keyframes glow-buy {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.3), inset 0 0 10px rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.5);
          }
          50% { 
            box-shadow: 0 0 35px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.2);
            border-color: rgba(34, 197, 94, 0.8);
          }
        }
        
        @keyframes glow-sell {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), inset 0 0 10px rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.5);
          }
          50% { 
            box-shadow: 0 0 35px rgba(239, 68, 68, 0.6), inset 0 0 20px rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.8);
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.05); }
        }
        
        @keyframes particle-float {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-10px) rotate(360deg); opacity: 0; }
        }
        
        @keyframes wave {
          0%, 100% { transform: translateX(-100%) skewX(0deg); }
          50% { transform: translateX(100%) skewX(5deg); }
        }
        
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes whale-pulse {
          0%, 100% { transform: scale(1) rotate(0deg); text-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
          50% { transform: scale(1.1) rotate(5deg); text-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
        }
        
        @keyframes data-stream {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        .whale-glow {
          animation: pulse-glow 2s ease-in-out infinite;
          background: linear-gradient(-45deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8));
          background-size: 400% 400%;
          animation: pulse-glow 2s ease-in-out infinite, gradient-shift 4s ease infinite;
        }
        
        .trade-enter {
          animation: slide-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), data-stream 0.8s ease-out;
          transform-style: preserve-3d;
        }
        
        .buy-glow {
          animation: glow-buy 2.5s ease-in-out infinite;
          border: 1px solid transparent;
        }
        
        .sell-glow {
          animation: glow-sell 2.5s ease-in-out infinite;
          border: 1px solid transparent;
        }
        
        .whale-float {
          animation: float 3s ease-in-out infinite, whale-pulse 4s ease-in-out infinite;
        }
        
        .particle {
          animation: particle-float linear infinite;
        }
        
        .wave-bg {
          background: linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent);
          animation: wave 6s ease-in-out infinite;
        }
        
        .symbol-glow {
          text-shadow: 0 0 10px currentColor;
          animation: data-stream 0.5s ease-out;
        }
        
        .whale-badge {
          animation: whale-pulse 1.5s ease-in-out infinite;
        }
        
        .copy-btn {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .copy-btn:hover {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 0 5px 15px rgba(59, 130, 246, 0.4);
        }
      `}</style>

      {/* Header */}
      <div className="relative p-4 whale-glow border-b border-gray-700/50 backdrop-blur-sm z-10">
        <div className="flex justify-between items-center text-sm font-semibold mb-3">
          <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
            WHALE RADAR
          </span>
          <div className={`w-3 h-3 rounded-full transition-all duration-500 relative ${
            connected ? 'bg-green-400' : 'bg-red-500'
          }`}>
            <div className={`absolute inset-0 rounded-full animate-ping ${
              connected ? 'bg-green-400' : 'bg-red-500'
            }`} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs mb-3 text-gray-300">
          <span className="text-blue-400 font-bold">${(threshold/1000).toFixed(0)}K</span>
          <div className="flex-1 relative">
            <input
              type="range"
              min={50_000}
              max={1_000_000}
              step={25_000}
              value={threshold}
              onChange={e => setThreshold(+e.target.value)}
              className="w-full h-2 bg-gray-700/50 rounded-lg cursor-pointer accent-blue-500 transition-all duration-300 hover:bg-gray-600/50 backdrop-blur-sm"
            />
            <div 
              className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg pointer-events-none"
              style={{ width: `${((threshold - 50000) / (1000000 - 50000)) * 100}%` }}
            />
          </div>
          <span className="text-purple-400 font-bold">$1M</span>
        </div>

        <select
          value={assetFilter}
          onChange={e => setAssetFilter(e.target.value)}
          className="w-full bg-gray-800/80 border border-gray-600/50 text-white text-xs p-2 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-300 hover:bg-gray-700/80 backdrop-blur-sm"
        >
          <option value="ALL">🌊 All Assets</option>
          {['BTC', 'ETH', 'SOL', 'HYPE'].map(c => (
            <option key={c} value={c}>₿ {c}</option>
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
                  className={`trade-enter flex items-center p-3 rounded-lg transition-all duration-500 hover:scale-[1.03] transform relative overflow-hidden ${
                    isBuy 
                      ? `bg-gradient-to-r from-green-900/30 to-green-800/20 border-l-4 border-green-500 hover:from-green-800/40 hover:to-green-700/30 ${isLarge ? 'buy-glow' : ''}` 
                      : `bg-gradient-to-r from-red-900/30 to-red-800/20 border-l-4 border-red-500 hover:from-red-800/40 hover:to-red-700/30 ${isLarge ? 'sell-glow' : ''}`
                  }`}
                >
                  {/* Animated background overlay */}
                  <div className={`absolute inset-0 opacity-20 ${
                    isBuy ? 'bg-gradient-to-r from-transparent via-green-400/10 to-transparent' : 'bg-gradient-to-r from-transparent via-red-400/10 to-transparent'
                  }`} style={{ animation: 'wave 3s ease-in-out infinite' }} />
                  
                  <div className="flex-1 relative z-10">
                    <div className={`font-bold text-lg tracking-wider symbol-glow ${
                      isBuy ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.symbol}
                      {isLarge && (
                        <span className="ml-2 text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-2 py-1 rounded-full whale-badge font-extrabold">
                          🐋 WHALE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-300 leading-tight font-medium">
                      {usd(t.notional)} @ ${t.price.toLocaleString()}
                    </div>
                    <div className={`text-xs font-bold mt-1 flex items-center gap-1 ${
                      isBuy ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        isBuy ? 'bg-green-400' : 'bg-red-400'
                      }`} style={{ animation: 'whale-pulse 2s ease-in-out infinite' }} />
                      {isBuy ? 'BUY' : 'SELL'}
                    </div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(t.wallet)}
                    className="ml-3 bg-gradient-to-r from-gray-700/80 to-gray-600/80 hover:from-blue-600 hover:to-blue-500 text-white text-xs px-3 py-2 rounded-lg border border-gray-500/50 copy-btn backdrop-blur-sm"
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
