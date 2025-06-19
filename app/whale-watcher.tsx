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
  const [threshold, setThreshold] = useState(50000); // Default 50K

  // Sound effect function
  const playTradeSound = (notional: number) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const frequency = 800; // Base frequency for the "bling" sound
      const duration = 0.15; // Duration of each beep
      
      // Determine number of beeps based on trade size
      let beepCount = 1;
      if (notional >= 200000) beepCount = 3; // Triple bling for 200K+
      else if (notional >= 100000) beepCount = 2; // Double bling for 100K+
      
      for (let i = 0; i < beepCount; i++) {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';
          
          // Quick attack and decay for bling effect
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, i * 200); // 200ms delay between beeps
      }
    } catch (error) {
      console.log('Audio not available:', error);
    }
  };

  useEffect(() => {
    console.log('Attempting to connect to Hyperliquid WebSocket...');
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      console.log('WebSocket connected, subscribing to fills...');
      setConnected(true);
      ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'allMids'
        }
      }));
      // Subscribe to multiple coins
      const coins = ['BTC', 'ETH', 'SOL', 'HYPE'];
      coins.forEach(coin => {
        ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'trades',
            coin: coin
          }
        }));
      });
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
              return notional >= threshold;
            })
            .map((f: any) => ({
              symbol: f.coin || 'BTC',
              notional: parseFloat(f.sz) * parseFloat(f.px),
              price: parseFloat(f.px),
              dir: f.side === 'A' ? 'A' : 'B',
              wallet: f.users && f.users.length > 0 ? f.users[0] : `0x${Math.random().toString(16).substr(2, 8)}...`,
              timestamp: f.time || Date.now(),
            })) as WhaleTrade[];

          if (newFills.length > 0) {
            // Play sound for the largest trade in this batch
            const largestTrade = newFills.reduce((max, trade) => 
              trade.notional > max.notional ? trade : max, newFills[0]);
            playTradeSound(largestTrade.notional);
            
            setTrades((prev) => [...newFills, ...prev.slice(0, 29)]);
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setConnected(false);
    };

    return () => {
      console.log('Closing WebSocket connection');
      ws.close();
    };
  }, []);

  const formatUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const getBackgroundColor = (trade: WhaleTrade) => {
    const intensity = Math.min(trade.notional / 500000, 1); // Max intensity at 500K
    if (trade.dir === 'B') {
      // Buy orders - green
      const greenValue = Math.floor(100 + (155 * intensity)); // 100-255 range
      return `rgb(0, ${greenValue}, 0)`;
    } else {
      // Sell orders - red
      const redValue = Math.floor(100 + (155 * intensity)); // 100-255 range
      return `rgb(${redValue}, 0, 0)`;
    }
  };

  return (
    <div className="fixed top-20 right-4 w-[350px] max-h-[90vh] overflow-y-auto bg-gray-800 shadow-lg rounded-lg border border-gray-600 z-50">
      <div className="p-3 border-b font-semibold bg-gray-700 text-white rounded-t-lg">
        <div className="flex justify-between items-center mb-2">
          <span>Whale Trades (${(threshold/1000).toFixed(0)}K+)</span>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>$50K</span>
          <input
            type="range"
            min="50000"
            max="1000000"
            step="25000"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1 h-1 bg-gray-600 rounded appearance-none cursor-pointer"
          />
          <span>$1M</span>
        </div>
      </div>
      <ul className="divide-y text-sm">
        {trades.length === 0 ? (
          <li className="px-3 py-4 text-gray-500 text-center">
            {connected ? 'Waiting for whale trades...' : 'Connecting...'}
          </li>
        ) : (
          trades.map((trade, i) => (
            <li 
              key={i} 
              className={`flex justify-between items-center px-3 py-2 border-l-4 ${
                trade.dir === 'B' ? 'border-green-300' : 'border-red-300'
              }`}
              style={{ backgroundColor: getBackgroundColor(trade) }}
            >
              <div className="flex-1">
                <div className="font-medium text-white">{trade.symbol}</div>
                <div className="text-xs text-gray-200">
                  {formatUsd(trade.notional)} @ ${trade.price.toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(trade.wallet)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs ml-2 flex-shrink-0"
                title={`Copy wallet address`}
              >
                Copy
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
