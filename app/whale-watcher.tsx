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

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Initialize audio context on user interaction
  const enableSound = async () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      setAudioContext(ctx);
      setSoundEnabled(true);
    } catch (error) {
      console.log('Audio not supported:', error);
    }
  };

  // Enhanced oscillator sound logic
  const playTradeSound = (notional: number, isBuy: boolean) => {
    if (!audioContext || !soundEnabled) return;
    
    try {
      const beep = (start: number, pitch: number) => {
        const o = audioContext.createOscillator();
        const g = audioContext.createGain();
        o.connect(g);
        g.connect(audioContext.destination);
        o.type = 'sine';
        o.frequency.value = pitch;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.15, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        o.start(start);
        o.stop(start + 0.15);
      };

      const beepCount = Math.min(Math.floor(notional / 50000), 5); // up to 5 beeps
      const pitch = isBuy ? 1000 : 400;
      const startTime = audioContext.currentTime;

      for (let i = 0; i < beepCount; i++) {
        beep(startTime + i * 0.12, pitch);
      }
    } catch (error) {
      console.log('Sound playback failed:', error);
    }
  };

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

        if (!fresh.length) return;

        const maxTrade = fresh.reduce((a, b) => a.notional > b.notional ? a : b);
        playTradeSound(maxTrade.notional, maxTrade.dir === 'B');

        setTrades(prev => [...fresh, ...prev].slice(0, 50));
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, [threshold]);

  const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const bg = (t: WhaleTrade) => {
    const x = Math.min(t.notional / 500_000, 1);
    if (t.dir === 'B') return `rgb(0,${100 + 155 * x},0)`;
    return `rgb(${100 + 155 * x},0,0)`;
  };

  return (
    <div className="fixed top-20 right-4 w-[360px] max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50">
      <div className="bg-gray-700 text-white p-3 border-b rounded-t-lg">
        <div className="flex justify-between items-center text-sm font-semibold mb-2">
          <span>Whale Trades ({usd(threshold)}+)</span>
          <div className="flex items-center gap-2">
            <button
              onClick={enableSound}
              className={`px-2 py-1 text-xs rounded ${
                soundEnabled ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'
              }`}
              title={soundEnabled ? 'Sound enabled' : 'Click to enable sound'}
            >
              🔊
            </button>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>
        </div>
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
              Copy Wallet
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
