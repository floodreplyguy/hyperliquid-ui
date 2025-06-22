
'use client';

import { useEffect, useState, useRef } from 'react';

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
  const [intensity, setIntensity] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

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

      const beepCount = Math.min(Math.floor(notional / 50000), 5);
      const pitch = isBuy ? 1000 : 400;
      const startTime = audioContext.currentTime;

      for (let i = 0; i < beepCount; i++) {
        beep(startTime + i * 0.12, pitch);
      }
    } catch (error) {
      console.log('Sound playback failed:', error);
    }
  };

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

  // Animated background canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let waveIntensity = intensity;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Create gradient that flows upward
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      
      // Base dark colors with flowing white gradients
      const baseAlpha = 0.1 + (Math.sin(time * 0.002) * 0.05);
      const waveAlpha = 0.3 + (Math.sin(time * 0.004 + Math.PI) * 0.2) * waveIntensity;
      
      gradient.addColorStop(0, `rgba(255, 255, 255, ${waveAlpha})`);
      gradient.addColorStop(0.3, `rgba(200, 200, 255, ${baseAlpha * 0.5})`);
      gradient.addColorStop(0.7, `rgba(100, 100, 150, ${baseAlpha * 0.3})`);
      gradient.addColorStop(1, 'rgba(20, 20, 30, 0.1)');

      // Create flowing waves
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let x = 0; x <= width; x += 5) {
        const y = height - (
          Math.sin((x + time) * 0.01) * 30 * waveIntensity +
          Math.sin((x + time * 1.5) * 0.005) * 50 * waveIntensity +
          Math.sin((x + time * 0.7) * 0.003) * 20 * waveIntensity +
          100
        );
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Add secondary wave layer
      const gradient2 = ctx.createLinearGradient(0, height, 0, 0);
      gradient2.addColorStop(0, `rgba(255, 255, 255, ${waveAlpha * 0.7})`);
      gradient2.addColorStop(0.5, `rgba(180, 180, 220, ${baseAlpha * 0.3})`);
      gradient2.addColorStop(1, 'rgba(40, 40, 60, 0.05)');

      ctx.fillStyle = gradient2;
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let x = 0; x <= width; x += 5) {
        const y = height - (
          Math.sin((x + time * 1.2) * 0.008) * 40 * waveIntensity +
          Math.sin((x + time * 0.8) * 0.006) * 30 * waveIntensity +
          80
        );
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      time += 1;
      
      // Gradually reduce intensity back to normal
      if (waveIntensity > 1) {
        waveIntensity = Math.max(1, waveIntensity - 0.02);
        setIntensity(waveIntensity);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

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
        
        // Increase wave intensity based on trade size
        const tradeIntensity = Math.min(3, 1 + (maxTrade.notional / 100000));
        setIntensity(prev => Math.max(prev, tradeIntensity));
        
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

  return (
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-black overflow-hidden">
      {/* Animated Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'radial-gradient(ellipse at bottom, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)' }}
      />
      
      {/* Content Overlay */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="bg-black bg-opacity-60 backdrop-blur-sm border-b border-white border-opacity-20 p-4">
          <div className="flex justify-between items-center text-sm font-semibold mb-3">
            <span className="text-white text-lg font-bold tracking-wider">WHALE RADAR</span>
            <div className="flex items-center gap-3">
              <button
                onClick={enableSound}
                className={`px-3 py-2 text-xs rounded-full border transition-all duration-300 ${
                  soundEnabled 
                    ? 'bg-white text-black border-white shadow-lg shadow-white/20' 
                    : 'bg-black bg-opacity-50 text-white border-white border-opacity-30 hover:border-opacity-60'
                }`}
                title={soundEnabled ? 'Sound enabled' : 'Click to enable sound'}
              >
                🔊
              </button>
              <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                connected 
                  ? 'bg-white shadow-lg shadow-white/50' 
                  : 'bg-red-500 shadow-lg shadow-red-500/50'
              }`} />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs mb-3 text-white text-opacity-80">
            <span>$50K</span>
            <input
              type="range"
              min={50_000}
              max={1_000_000}
              step={25_000}
              value={threshold}
              onChange={e => setThreshold(+e.target.value)}
              className="flex-1 h-1 bg-white bg-opacity-20 rounded cursor-pointer accent-white"
            />
            <span>$1M</span>
          </div>
          
          <select
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value)}
            className="w-full bg-black bg-opacity-50 border border-white border-opacity-30 text-white text-xs p-2 rounded backdrop-blur-sm focus:border-opacity-60 focus:outline-none"
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
            <div className="flex items-center justify-center h-full text-white text-opacity-60 text-center px-4">
              <div>
                <div className="text-2xl mb-2">🐋</div>
                <div className="text-sm">
                  {connected ? 'Waiting for whale movements...' : 'Connecting to the depths...'}
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-white divide-opacity-10">
              {trades.filter(t => assetFilter === 'ALL' || t.symbol === assetFilter).map((t, i) => {
                const intensity = Math.min(1, t.notional / 200_000);
                const isBuy = t.dir === 'B';
                
                return (
                  <li
                    key={`${t.timestamp}-${i}`}
                    className={`flex items-center px-4 py-3 transition-all duration-500 hover:bg-white hover:bg-opacity-10 ${
                      isBuy 
                        ? 'border-l-4 border-white' 
                        : 'border-l-4 border-black'
                    }`}
                    style={{
                      backgroundColor: isBuy 
                        ? `rgba(255, 255, 255, ${0.05 + intensity * 0.1})` 
                        : `rgba(0, 0, 0, ${0.1 + intensity * 0.15})`
                    }}
                  >
                    <div className="flex-1">
                      <div className={`font-bold text-lg tracking-wider ${
                        isBuy ? 'text-white' : 'text-gray-300'
                      }`}>
                        {t.symbol}
                      </div>
                      <div className="text-xs text-white text-opacity-70 leading-tight">
                        {usd(t.notional)} @ ${t.price.toLocaleString()}
                      </div>
                      <div className={`text-xs font-bold mt-1 ${
                        isBuy ? 'text-white' : 'text-gray-400'
                      }`}>
                        {isBuy ? 'BUY' : 'SELL'}
                      </div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(t.wallet)}
                      className="ml-3 bg-white bg-opacity-10 hover:bg-opacity-20 text-white text-xs px-3 py-2 rounded border border-white border-opacity-30 transition-all duration-300 backdrop-blur-sm"
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
    </div>
  );
}
