'use client';

import { useEffect, useState } from 'react';

interface WhaleTrade {
  symbol: string;
  notional: number;
  dir: 'A' | 'B';
  wallet: string;
  timestamp: number;
}

export default function WhaleWatcher() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);

  useEffect(() => {
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          method: 'subscribe',
          topic: 'v1/fills',
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data?.data?.fills) return;
        const newFills = data.data.fills
          .filter((f: any) => f.notional >= 10_000)
          .map((f: any) => ({
            symbol: f.coin,
            notional: f.notional,
            dir: f.dir,
            wallet: f.trader,
            timestamp: f.time,
          })) as WhaleTrade[];
        setTrades((prev) => [...newFills, ...prev.slice(0, 29)]);
      } catch (e) {
        console.error('Error parsing fill:', e);
      }
    };

    return () => ws.close();
  }, []);

  const formatUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="fixed top-20 right-4 w-[350px] max-h-[90vh] overflow-y-auto bg-white shadow-lg rounded-lg border border-gray-300 z-50">
      <div className="p-3 border-b font-semibold bg-black text-white rounded-t-lg">
        Whale Trades ($100K+)
      </div>
      <ul className="divide-y text-sm">
        {trades.map((trade, i) => (
          <li key={i} className="flex justify-between items-center px-3 py-2">
            <div>
              <div className="font-medium">{trade.symbol}</div>
              <div className="text-xs text-gray-500">
                {trade.dir === 'B' ? 'Buy' : 'Sell'} – {formatUsd(trade.notional)}
              </div>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(trade.wallet)}
              className="text-blue-500 hover:underline text-xs"
            >
              Copy Wallet
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
