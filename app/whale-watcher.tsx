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
  const [threshold, setThreshold] = useState(50000); // default $50 K
  const [assetFilter, setAssetFilter] = useState('ALL'); // ALL, BTC, ETH, …

  /* --------------------------------------------------
     UTIL:  tiny "bling" sound when a big trade arrives
  -------------------------------------------------- */
  const playTradeSound = (notional: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (start: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.value = 800;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.15, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        o.start(start);
        o.stop(start + 0.15);
      };
      const beeps = notional >= 200_000 ? 3 : notional >= 100_000 ? 2 : 1;
      const t0 = ctx.currentTime;
      [...Array(beeps)].forEach((_, i) => beep(t0 + i * 0.2));
    } catch {
      /* silent — audio not available on some devices */
    }
  };

  /* --------------------------------------------------
     EFFECT: open Hyperliquid WS and stream trades
  -------------------------------------------------- */
  useEffect(() => {
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      setConnected(true);
      // subscribe to all mids (required keep‑alive) + specific coins
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
      ['BTC', 'ETH', 'SOL', 'HYPE'].forEach(coin =>
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }))
      );
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg?.channel !== 'trades') return;

        const fresh = (msg.data as any[]) // HL schema: array of fills
          .filter(f => +f.sz * +f.px >= threshold)
          .map(f => ({
            symbol: f.coin,
            notional: +f.sz * +f.px,
            price: +f.px,
            dir: f.side === 'A' ? 'A' : 'B',
            wallet: f.users?.[0] ?? 'unknown',
            timestamp: f.time ?? Date.now(),
          })) as WhaleTrade[];

        if (!fresh.length) return;
        playTradeSound(fresh.reduce((m, t) => (t.notional > m ? t.notional : m), 0));
        setTrades(prev => [...fresh, ...prev].slice(0, 50));
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, [threshold]);

  /* --------------------------------------------------
     helpers
  -------------------------------------------------- */
  const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const bg = (t: WhaleTrade) => {
    const x = Math.min(t.notional / 500_000, 1);
    if (t.dir === 'B') return `rgb(0,${100 + 155 * x},0)`; // buys → green
    return `rgb(${100 + 155 * x},0,0)`; // sells → red
  };

  /* --------------------------------------------------
     render
  -------------------------------------------------- */
  return (
    <div className="fixed top-20 right-4 w-[360px] max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
      {/* header */}
      <div className="bg-gray-700 text-white p-3 border-b rounded-t-lg">
        <div className="flex justify-between items-center text-sm font-semibold mb-2">
          <span>Whale Trades ({usd(threshold) }+)</span>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        {/* threshold slider */}
        <div className="flex items-center gap-2 text-xs mb-2">
          <span>$50K</span>
          <input
            type="range"
            min={50_000}
            max={1_000_000}
            step={25_000}
            value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="flex-1 h-1 bg-gray-600 rounded cursor-pointer"
          />
          <span>$1M</span>
        </div>
        {/* asset filter */}
        <select
          value={assetFilter}
          onChange={e => setAssetFilter(e.target.value)}
          className="w-full bg-gray-700 border border-gray-500 text-xs p-1 rounded"
        >
          <option value="ALL">All Assets</option>
          {['BTC', 'ETH', 'SOL', 'HYPE'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* list */}
      <ul className="text-sm divide-y divide-gray-700">
        {trades.filter(t => assetFilter === 'ALL' || t.symbol === assetFilter).map((t, i) => (
          <li
            key={`${t.timestamp}-${i}`}
            style={{ backgroundColor: bg(t) }}
            className={`flex items-center px-3 py-2 border-l-4 ${t.dir === 'B' ? 'border-green-300' : 'border-red-300'}`}
          >
            <div className="flex-1 text-white">
              <div className="font-medium leading-tight">{t.symbol}</div>
              <div className="text-xs text-gray-200 leading-tight">
                {usd(t.notional)} @ ${t.price.toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(t.wallet)}
              className="ml-2 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
              title="Copy wallet address"
            >
              Copy&nbsp;Wallet
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
