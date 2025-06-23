'use client';

import { useEffect, useState } from 'react';

interface WhaleTrade {
  symbol: string;
  notional: number;
  price: number;
  dir: 'A' | 'B';
  wallet: string;
  timestamp: number;
  receivedAt: number;
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
            receivedAt: Date.now(),
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

  const getTimeAgo = (receivedAt: number) => {
    const seconds = Math.floor((Date.now() - receivedAt) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="h-full bg-gradient-to-b from-gray-900 via-black to-gray-800 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 border-b-2 border-green-500 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 clip-path-diamond" />
            <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              WHALE RADAR
            </span>
          </div>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'} animate-pulse`} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span className="font-bold">${(threshold/1000).toFixed(0)}K</span>
            <input
              type="range"
              min={50_000}
              max={1_000_000}
              step={25_000}
              value={threshold}
              onChange={e => setThreshold(+e.target.value)}
              className="flex-1 h-2 bg-gray-700 rounded-lg cursor-pointer accent-green-500"
            />
            <span className="font-bold">$1M</span>
          </div>

          <select
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value)}
            className="w-full bg-gray-800 border border-green-500/30 text-white text-sm p-2 rounded focus:border-green-500 focus:outline-none"
          >
            <option value="ALL">🌊 All Assets</option>
            {['BTC', 'ETH', 'SOL', 'HYPE'].map(c => (
              <option key={c} value={c}>₿ {c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto">
        {trades.filter(t => assetFilter === 'ALL' || t.symbol === assetFilter).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-center px-4">
            <div>
              <div className="text-4xl mb-3">🎯</div>
              <div className="text-sm font-bold">
                {connected ? 'SCANNING FOR WHALES...' : 'ESTABLISHING CONNECTION...'}
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
                  className={`p-3 rounded border-l-4 transition-all hover:scale-[1.02] trade-item ${
                    isBuy 
                      ? 'bg-gradient-to-r from-green-900/40 to-green-800/25 border-green-500' 
                      : 'bg-gradient-to-r from-red-900/40 to-red-800/25 border-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={`font-bold text-lg tracking-wider ${
                        isBuy ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {t.symbol}
                        {isLarge && (
                          <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded font-bold">
                            🐋 WHALE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-300 font-mono">
                        {usd(t.notional)} @ ${t.price.toLocaleString()}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className={`text-xs font-bold ${
                          isBuy ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {isBuy ? '🟢 BUY' : '🔴 SELL'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {getTimeAgo(t.receivedAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(t.wallet)}
                      className="ml-3 bg-green-600 hover:bg-green-500 text-black text-xs px-2 py-1 rounded font-bold transition-colors"
                      title="Copy wallet address"
                    >
                      📋
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .clip-path-diamond {
          clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
        }

        @keyframes slide-down {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); }
        }

        .trade-item.slide-down {
          animation: slide-down 0.3s ease;
        }
      `}</style>
    </div>
  );
}
