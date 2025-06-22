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
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center text-sm font-semibold mb-3">
          <span className="text-lg font-bold tracking-wider">WHALE RADAR</span>
          <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
            connected ? 'bg-green-400' : 'bg-red-500'
          }`} />
        </div>

        <div className="flex items-center gap-2 text-xs mb-3 text-gray-300">
          <span>$50K</span>
          <input
            type="range"
            min={50_000}
            max={1_000_000}
            step={25_000}
            value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="flex-1 h-1 bg-gray-600 rounded cursor-pointer accent-white"
          />
          <span>$1M</span>
        </div>

        <select
          value={assetFilter}
          onChange={e => setAssetFilter(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 text-white text-xs p-2 rounded focus:border-gray-400 focus:outline-none"
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
            <div>
              <div className="text-2xl mb-2">🐋</div>
              <div className="text-sm">
                {connected ? 'Waiting for whale movements...' : 'Connecting to the depths...'}
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-700">
            {trades.filter(t => assetFilter === 'ALL' || t.symbol === assetFilter).map((t, i) => {
              const isBuy = t.dir === 'B';

              return (
                <li
                  key={`${t.timestamp}-${i}`}
                  className={`flex items-center px-4 py-3 transition-all duration-300 hover:bg-gray-800 ${
                    isBuy ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
                  }`}
                >
                  <div className="flex-1">
                    <div className={`font-bold text-lg tracking-wider ${
                      isBuy ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {t.symbol}
                    </div>
                    <div className="text-xs text-gray-400 leading-tight">
                      {usd(t.notional)} @ ${t.price.toLocaleString()}
                    </div>
                    <div className={`text-xs font-bold mt-1 ${
                      isBuy ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {isBuy ? 'BUY' : 'SELL'}
                    </div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(t.wallet)}
                    className="ml-3 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded border border-gray-600 transition-all duration-300"
                    title="Copy wallet address"
                  >
                    COPY
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
