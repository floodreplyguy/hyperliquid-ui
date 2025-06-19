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
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    console.log('Attempting to connect to Hyperliquid WebSocket...');
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      console.log('WebSocket connected, subscribing to fills...');
      ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'allMids'
        }
      }));
      // Also try the fills subscription
      ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'trades',
          coin: 'BTC'
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        // Handle different message types
        if (data?.channel === 'trades' && data?.data) {
          const newFills = data.data
            .filter((f: any) => {
              const notional = parseFloat(f.sz) * parseFloat(f.px);
              return notional >= 10_000;
            })
            .map((f: any) => ({
              symbol: f.coin || 'BTC',
              notional: parseFloat(f.sz) * parseFloat(f.px),
              dir: f.side === 'A' ? 'A' : 'B',
              wallet: f.user || 'Unknown',
              timestamp: f.time || Date.now(),
            })) as WhaleTrade[];

          if (newFills.length > 0) {
            setTrades((prev) => [...newFills, ...prev.slice(0, 29)]);
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
    };

    return () => {
      console.log('Closing WebSocket connection');
      ws.close();
    };
  }, []);

  const formatUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="fixed top-20 right-4 w-[350px] max-h-[90vh] overflow-y-auto bg-white shadow-lg rounded-lg border border-gray-300 z-50">
      <div className="p-3 border-b font-semibold bg-black text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <span>Whale Trades ($100K+)</span>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
        </div>
      </div>
      <ul className="divide-y text-sm">
        {trades.length === 0 ? (
          <li className="px-3 py-4 text-gray-500 text-center">
            {connected ? 'Waiting for whale trades...' : 'Connecting...'}
          </li>
        ) : (
          trades.map((trade, i) => (
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
          ))
        )}
      </ul>
    </div>
  );
}
