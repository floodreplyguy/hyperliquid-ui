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
          setTrades(prev => {
            const newTrades = [...fresh, ...prev].slice(0, 50);
            // Trigger slide-down animation for existing trades
            setTimeout(() => {
              const tradeElements = document.querySelectorAll('.trade-item');
              tradeElements.forEach((el, index) => {
                if (index >= fresh.length) {
                  el.classList.add('slide-down');
                }
              });
            }, 50);
            return newTrades;
          });
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
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className={`absolute rounded-full particle ${
                Math.random() > 0.7 ? 'w-2 h-2' : 'w-1 h-1'
              }`}
              style={{
                background: `radial-gradient(circle, ${
                  ['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 101, 101, 0.8)'][Math.floor(Math.random() * 4)]
                }, transparent)`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 15}s`,
                animationDuration: `${10 + Math.random() * 8}s`,
                filter: 'blur(0.5px)',
                boxShadow: '0 0 10px currentColor'
              }}
            />
          ))}
        </div>
        
        {/* Dynamic Wave Background */}
        <div className="absolute inset-0 wave-bg opacity-10" />
      </div>

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 0 0 25px rgba(59, 130, 246, 0.4), inset 0 0 15px rgba(59, 130, 246, 0.1);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.8), inset 0 0 25px rgba(59, 130, 246, 0.3);
            transform: scale(1.02);
          }
        }
        
        @keyframes slide-in {
          0% { 
            transform: translateX(100%) rotateY(90deg) scale(0.8); 
            opacity: 0; 
            filter: blur(10px);
          }
          50% {
            transform: translateX(20%) rotateY(45deg) scale(0.95);
            opacity: 0.7;
            filter: blur(2px);
          }
          100% { 
            transform: translateX(0) rotateY(0deg) scale(1); 
            opacity: 1; 
            filter: blur(0px);
          }
        }
        
        @keyframes slide-down {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); }
        }
        
        @keyframes glow-buy {
          0%, 100% { 
            box-shadow: 0 0 25px rgba(34, 197, 94, 0.4), inset 0 0 15px rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.6);
            transform: scale(1);
          }
          25% { 
            box-shadow: 0 0 45px rgba(34, 197, 94, 0.7), inset 0 0 25px rgba(34, 197, 94, 0.2);
            border-color: rgba(34, 197, 94, 0.9);
            transform: scale(1.03);
          }
          75% { 
            box-shadow: 0 0 35px rgba(34, 197, 94, 0.6), inset 0 0 20px rgba(34, 197, 94, 0.15);
            border-color: rgba(34, 197, 94, 0.7);
            transform: scale(1.01);
          }
        }
        
        @keyframes glow-sell {
          0%, 100% { 
            box-shadow: 0 0 25px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.6);
            transform: scale(1);
          }
          25% { 
            box-shadow: 0 0 45px rgba(239, 68, 68, 0.7), inset 0 0 25px rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.9);
            transform: scale(1.03);
          }
          75% { 
            box-shadow: 0 0 35px rgba(239, 68, 68, 0.6), inset 0 0 20px rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.7);
            transform: scale(1.01);
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
        
        @keyframes particle-float {
          0% { 
            transform: translateY(100vh) scale(0); 
            opacity: 0; 
          }
          10% { 
            opacity: 1; 
            transform: translateY(90vh) scale(1);
          }
          50% {
            transform: translateY(50vh) scale(1.1);
          }
          90% { 
            opacity: 1; 
            transform: translateY(10vh) scale(0.9);
          }
          100% { 
            transform: translateY(-10px) scale(0); 
            opacity: 0; 
          }
        }
        
        @keyframes gentle-wave {
          0%, 100% { 
            transform: translateX(-100%) scaleY(1); 
            opacity: 0.1;
          }
          50% { 
            transform: translateX(100%) scaleY(1.1); 
            opacity: 0.2;
          }
        }
        
        @keyframes subtle-glow {
          0%, 100% { 
            filter: hue-rotate(0deg) brightness(1);
          }
          50% {
            filter: hue-rotate(60deg) brightness(1.1);
          }
        }
        
        @keyframes balanced-pulse {
          0%, 100% { 
            transform: scale(1); 
            text-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
          }
          50% { 
            transform: scale(1.05); 
            text-shadow: 0 0 25px rgba(147, 51, 234, 0.8);
          }
        }
        
        @keyframes smooth-entry {
          0% { 
            opacity: 0; 
            transform: translateY(20px) scale(0.9); 
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        
        @keyframes gentle-breathe {
          0%, 100% { 
            transform: scale(1);
            filter: brightness(1);
          }
          50% { 
            transform: scale(1.01);
            filter: brightness(1.05);
          }
        }
        
        .whale-glow {
          animation: pulse-glow 4s ease-in-out infinite, subtle-glow 8s ease infinite;
          background: linear-gradient(-45deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8));
          transition: all 0.3s ease;
        }
        
        .trade-item {
          animation: slide-in 0.6s ease-out, smooth-entry 0.8s ease-out;
          transition: all 0.3s ease;
        }
        
        .trade-item.slide-down {
          animation: slide-down 0.3s ease;
        }
        
        .buy-glow {
          animation: glow-buy 4s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        
        .sell-glow {
          animation: glow-sell 4s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        
        .whale-float {
          animation: float 6s ease-in-out infinite, balanced-pulse 8s ease-in-out infinite;
        }
        
        .particle {
          animation: particle-float linear infinite;
        }
        
        .wave-bg {
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
          animation: gentle-wave 12s ease-in-out infinite;
        }
        
        .symbol-glow {
          text-shadow: 0 0 10px currentColor;
          animation: smooth-entry 0.5s ease-out;
        }
        
        .whale-badge {
          animation: balanced-pulse 3s ease-in-out infinite;
          filter: drop-shadow(0 0 8px currentColor);
        }
        
        .copy-btn {
          transition: all 0.2s ease;
          animation: gentle-breathe 8s ease-in-out infinite;
        }
        
        .copy-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }
        
        .trade-item:hover {
          transform: scale(1.02) translateY(-1px);
          filter: brightness(1.05);
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
                  className={`trade-item flex items-center p-3 rounded-lg relative overflow-hidden ${
                    isBuy 
                      ? `bg-gradient-to-r from-green-900/40 to-green-800/25 border-l-4 border-green-500 hover:from-green-800/50 hover:to-green-700/35 ${isLarge ? 'buy-glow' : ''}` 
                      : `bg-gradient-to-r from-red-900/40 to-red-800/25 border-l-4 border-red-500 hover:from-red-800/50 hover:to-red-700/35 ${isLarge ? 'sell-glow' : ''}`
                  }`}
                >
                  {/* Animated background overlay */}
                  <div className={`absolute inset-0 opacity-25 ${
                    isBuy ? 'bg-gradient-to-r from-transparent via-green-400/15 to-transparent' : 'bg-gradient-to-r from-transparent via-red-400/15 to-transparent'
                  }`} style={{ 
                    animation: `wave ${3 + Math.random() * 2}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 2}s`
                  }} />
                  
                  {/* Additional organic shimmer effect */}
                  <div className={`absolute inset-0 opacity-10 ${
                    isBuy ? 'bg-gradient-to-br from-green-300/20 via-transparent to-green-500/20' : 'bg-gradient-to-br from-red-300/20 via-transparent to-red-500/20'
                  }`} style={{ 
                    animation: `gradient-shift ${5 + Math.random() * 3}s ease infinite`,
                    animationDelay: `${Math.random() * 3}s`
                  }} />
                  
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
