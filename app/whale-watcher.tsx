
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

interface Blob {
  id: number;
  x: number;
  y: number;
  radius: number;
  targetRadius: number;
  vx: number;
  vy: number;
  color: string;
  intensity: number;
  life: number;
  symbol: string;
  notional: number;
}

export default function WhaleWatcher() {
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [connected, setConnected] = useState(false);
  const [threshold, setThreshold] = useState(50000);
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [intensity, setIntensity] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>();

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  const blobsRef = useRef<Blob[]>([]);
  const nextBlobId = useRef(0);

  // Initialize audio context
  const initAudio = () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
      setSoundEnabled(true);
    }
  };

  // Play sound effect for trades
  const playTradeSound = (notional: number, isBuy: boolean) => {
    if (!audioContext || !soundEnabled) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Frequency based on trade size
    const baseFreq = isBuy ? 440 : 330; // A4 for buy, E4 for sell
    const freqMultiplier = Math.min(Math.log(notional / 50000) / Math.log(10), 2);
    oscillator.frequency.setValueAtTime(baseFreq * (1 + freqMultiplier * 0.5), audioContext.currentTime);

    // Volume based on trade size
    const volume = Math.min(notional / 500000, 0.3);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);

    oscillator.type = 'sine';
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.8);
  };

  // Create blob for new trade
  const createBlob = (trade: WhaleTrade) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isBuy = trade.dir === 'B';
    const sizeMultiplier = Math.log(trade.notional / threshold) / Math.log(10);
    const radius = Math.max(20, Math.min(80, 30 + sizeMultiplier * 20));

    const blob: Blob = {
      id: nextBlobId.current++,
      x: Math.random() * (canvas.width - radius * 2) + radius,
      y: Math.random() * (canvas.height - radius * 2) + radius,
      radius: 5,
      targetRadius: radius,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      color: isBuy ? '#00ff88' : '#ff4444',
      intensity: Math.min(trade.notional / 100000, 3),
      life: 1.0,
      symbol: trade.symbol,
      notional: trade.notional
    };

    blobsRef.current.push(blob);
    playTradeSound(trade.notional, isBuy);
  };

  // Animation loop
  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas with subtle trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw blobs
    blobsRef.current = blobsRef.current.filter(blob => {
      // Update blob physics
      blob.x += blob.vx * intensity;
      blob.y += blob.vy * intensity;

      // Smooth radius growth
      blob.radius += (blob.targetRadius - blob.radius) * 0.1;

      // Bounce off walls with damping
      if (blob.x - blob.radius <= 0 || blob.x + blob.radius >= canvas.width) {
        blob.vx *= -0.8;
        blob.x = Math.max(blob.radius, Math.min(canvas.width - blob.radius, blob.x));
      }
      if (blob.y - blob.radius <= 0 || blob.y + blob.radius >= canvas.height) {
        blob.vy *= -0.8;
        blob.y = Math.max(blob.radius, Math.min(canvas.height - blob.radius, blob.y));
      }

      // Gravity and friction
      blob.vy += 0.1 * intensity;
      blob.vx *= 0.995;
      blob.vy *= 0.995;

      // Life decay
      blob.life -= 0.002;

      // Blob interactions - organic merging and repulsion
      blobsRef.current.forEach(otherBlob => {
        if (blob.id !== otherBlob.id) {
          const dx = otherBlob.x - blob.x;
          const dy = otherBlob.y - blob.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = blob.radius + otherBlob.radius;

          if (distance < minDistance && distance > 0) {
            // Repulsion force
            const force = (minDistance - distance) / distance * 0.1;
            blob.vx -= dx * force;
            blob.vy -= dy * force;
          }

          // Attraction at medium distance for organic flow
          if (distance < minDistance * 2 && distance > minDistance) {
            const force = 0.01;
            blob.vx += dx * force;
            blob.vy += dy * force;
          }
        }
      });

      // Draw blob with glow effect
      const alpha = Math.max(0, blob.life);
      
      // Outer glow
      const gradient = ctx.createRadialGradient(
        blob.x, blob.y, 0,
        blob.x, blob.y, blob.radius * 2
      );
      gradient.addColorStop(0, blob.color + Math.floor(alpha * 100).toString(16).padStart(2, '0'));
      gradient.addColorStop(0.5, blob.color + '20');
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core blob
      ctx.fillStyle = blob.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing effect for intensity
      const pulseRadius = blob.radius + Math.sin(Date.now() * 0.01 + blob.id) * blob.intensity * 5;
      ctx.strokeStyle = blob.color + '40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      return blob.life > 0;
    });

    // Add ambient particles
    if (Math.random() < 0.02) {
      const ambientBlob: Blob = {
        id: nextBlobId.current++,
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        radius: Math.random() * 5 + 2,
        targetRadius: Math.random() * 5 + 2,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 2 - 1,
        color: '#444488',
        intensity: 0.5,
        life: 0.8,
        symbol: '',
        notional: 0
      };
      blobsRef.current.push(ambientBlob);
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 380;
      canvas.height = window.innerHeight;
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity]);

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
          fresh.forEach(trade => {
            if (assetFilter === 'ALL' || trade.symbol === assetFilter) {
              createBlob(trade);
            }
          });
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    return () => ws.close();
  }, [threshold, assetFilter]);

  const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="fixed top-0 right-0 w-[380px] h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-80 border-b border-gray-700 p-4 z-10">
        <div className="flex justify-between items-center text-sm font-semibold mb-3">
          <span className="text-lg font-bold tracking-wider">WHALE LAVA</span>
          <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
            connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'
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

        <div className="flex items-center gap-2 text-xs mb-3 text-gray-300">
          <span>Calm</span>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={intensity}
            onChange={e => setIntensity(+e.target.value)}
            className="flex-1 h-1 bg-gray-600 rounded cursor-pointer accent-white"
          />
          <span>Wild</span>
        </div>

        <div className="flex gap-2 mb-3">
          <select
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 text-white text-xs p-2 rounded focus:border-gray-400 focus:outline-none"
          >
            <option value="ALL">All Assets</option>
            {['BTC', 'ETH', 'SOL', 'HYPE'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={initAudio}
            className={`px-3 py-2 text-xs rounded border transition-all ${
              soundEnabled 
                ? 'bg-green-600 border-green-400 text-white' 
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🔊
          </button>
        </div>
      </div>

      {/* Lava Lamp Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ background: 'radial-gradient(circle at center, #000011 0%, #000000 100%)' }}
      />

      {/* Trade Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 p-4 z-10">
        <div className="text-xs text-gray-400 mb-2">
          Active Blobs: {blobsRef.current.length} | Threshold: {usd(threshold)}
        </div>
        {trades.slice(0, 3).map((trade, i) => (
          <div key={`${trade.timestamp}-${i}`} className="flex justify-between items-center text-xs mb-1">
            <span className={`font-bold ${trade.dir === 'B' ? 'text-green-400' : 'text-red-400'}`}>
              {trade.symbol}
            </span>
            <span className="text-gray-300">{usd(trade.notional)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
