'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// 🐳 Whale watcher runs only in the browser (WebSocket, clipboard)
const WhaleWatcher = dynamic(() => import('./whale-watcher'), { ssr: false });

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

/* ───────── Types ───────── */
interface TradeStats {
  trades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  totalPnl: number;
  volume: number;
  fees: number;
  top3: Record<string, number>;
}

interface ApiResponse {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  realizedPnl: number;
  volume: number;
  fees: number;
  avgNotional: number;
  mostTraded: string;
  longs: TradeStats;
  shorts: TradeStats;
  biggestOrders: { symbol: string; notional: number }[];
  biggestWinner: { symbol: string; pnl: number };
  biggestLoser: { symbol: string; pnl: number };
  pnlChart: { timestamp: number; pnl: number }[];
  positionTendency: string;
  recentLongs: number;
  recentShorts: number;
  confidenceScore: number;
  traderRank: { rank?: string; color?: string; icon?: string; gradient?: string; name?: string; displayName?: string; description?: string; logo?: string; min_score?: number; subTier?: number };
  winStreaks?: { current: number; best: number; worst: number };
  timeBreakdown: {
    days: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
    sessions: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
    hours: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
  };
  openPositions: { symbol: string; side: string; size: number; entryPrice: number; unrealizedPnl: number }[];
}

/* ───────── Helpers ───────── */
const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface WhaleTrade {
  symbol: string;
  notional: number;
  price: number;
  dir: 'A' | 'B';
  wallet: string;
  timestamp: number;
  receivedAt: number;
  id: string;
}

function StatCard({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`bg-gradient-to-br from-gray-800/80 to-gray-700/60 border ${highlight ? 'border-yellow-500/50' : 'border-green-500/30'} rounded p-2 backdrop-blur-sm`}>
      <div className="text-xs font-semibold text-green-400 mb-1 tracking-wide">{label}</div>
      <div className={`text-sm font-bold ${highlight ? 'text-yellow-400' : 'text-white'} break-all`}>{value}</div>
    </div>
  );
}

function LoadoutCard({ side, data, color }: { side: string; data: TradeStats; color: 'green' | 'red' }) {
  const colorClasses = {
    green: {
      border: 'border-green-500/30',
      title: 'text-green-400',
      accent: 'text-green-300'
    },
    red: {
      border: 'border-red-500/30',
      title: 'text-red-400',
      accent: 'text-red-300'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className={`bg-gradient-to-br from-gray-800/80 to-gray-700/60 border ${colors.border} rounded p-4 backdrop-blur-sm`}>
      <h3 className={`font-bold text-sm mb-3 ${colors.title} tracking-wider`}>{side}</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-gray-400 mb-1">Trades</div>
          <div className="text-sm font-bold text-white">{data.trades}</div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Win Rate</div>
          <div className={`text-sm font-bold ${colors.accent}`}>{pct(data.winRate)}</div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Avg Win</div>
          <div className="text-xs font-bold text-white">{usd(data.avgWin)}</div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Net PnL</div>
          <div className={`text-xs font-bold ${data.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {usd(data.totalPnl)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeCard({ title, type, data }: { title: string; type: string; data: Record<string, any> }) {
  const getItems = () => {
    if (type === 'days') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
        const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day)];
        return { label: day, data: data[fullDay] || { trades: 0, winRate: 0 } };
      });
    } else {
      return Object.entries(data).map(([key, value]) => ({
        label: key,
        data: value as { trades: number; winRate: number }
      }));
    }
  };

  const getColor = (itemData: { trades: number; winRate: number }) => {
    if (itemData.trades < 3) return 'bg-gray-700/60';
    if (itemData.winRate >= 0.7) return 'bg-green-500';
    if (itemData.winRate >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-3 backdrop-blur-sm">
      <h3 className="font-bold text-green-400 text-sm tracking-wider mb-2">{title}</h3>
      <div className={type === 'days' ? 'grid grid-cols-7 gap-1' : 'space-y-2'}>
        {getItems().map((item, i) => (
          <div key={i} className={type === 'days' ? 'text-center' : ''}>
            {type === 'days' ? (
              <>
                <div className="text-xs text-gray-400 mb-1 font-bold">{item.label}</div>
                <div 
                  className={`${getColor(item.data)} rounded h-8 flex items-center justify-center text-xs font-bold text-white`}
                  title={`${item.label}: ${item.data.trades} trades, ${(item.data.winRate * 100).toFixed(0)}% win rate`}
                >
                  {item.data.trades > 0 ? `${(item.data.winRate * 100).toFixed(0)}%` : '-'}
                </div>
              </>
            ) : (
              <div className={`${getColor(item.data)} rounded p-2`}>
                <div className="flex justify-between items-center">
                  <div className="font-bold text-white text-xs">{item.label}</div>
                  <div className="text-xs text-white/80">
                    {item.data.trades > 0 ? `${(item.data.winRate * 100).toFixed(0)}%` : '-'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Main Component ───────── */
export default function Page() {
  const [wallet, setWallet] = useState('');
  const [stats, setStats] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    if (!wallet.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setStats(null);
      const url = `https://pnl-dna-evansmargintrad.replit.app/stats?wallet=${wallet}&type=perp`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const json = (await res.json()) as ApiResponse | { error: string };
      console.log('Raw API response:', json);
      if ((json as any).error) throw new Error((json as any).error);
      const statsData = json as ApiResponse;
      console.log('Confidence score received:', statsData.confidenceScore);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const openWhaleWatcherInNewTab = () => {
    const whaleWatcherWindow = window.open('', '_blank', 'width=400,height=800,scrollbars=yes');
    if (whaleWatcherWindow) {
      whaleWatcherWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Whale Watcher</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; background: #111827; font-family: system-ui, -apple-system, sans-serif; }
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
            .whale-glow {
              animation: pulse-glow 4s ease-in-out infinite;
              background: linear-gradient(-45deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8));
              transition: all 0.3s ease;
            }
            .trade-item {
              animation: slide-in 0.6s ease-out;
              transition: all 0.3s ease;
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
              animation: float 6s ease-in-out infinite;
            }
            .particle {
              animation: particle-float linear infinite;
            }
          </style>
        </head>
        <body>
          <div id="whale-watcher-root" style="width: 100%; height: 100vh;"></div>
          <script>
            // Standalone Whale Watcher Component
            class WhaleWatcher {
              constructor() {
                this.trades = [];
                this.connected = false;
                this.threshold = 50000;
                this.assetFilter = 'ALL';
                this.ws = null;
                this.init();
              }

              init() {
                this.render();
                this.connectWebSocket();
              }

              connectWebSocket() {
                this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

                this.ws.onopen = () => {
                  this.connected = true;
                  this.updateConnectionStatus();
                  this.ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
                  ['BTC', 'ETH', 'SOL', 'HYPE'].forEach(coin =>
                    this.ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }))
                  );
                };

                this.ws.onmessage = (e) => {
                  try {
                    const msg = JSON.parse(e.data);
                    if (msg?.channel !== 'trades') return;

                    const fresh = (msg.data || [])
                      .filter(f => +f.sz * +f.px >= this.threshold)
                      .map(f => ({
                        symbol: f.coin,
                        notional: +f.sz * +f.px,
                        price: +f.px,
                        dir: f.side === 'A' ? 'A' : 'B',
                        wallet: f.users?.[0] ?? 'unknown',
                        timestamp: f.time ?? Date.now(),
                        receivedAt: Date.now(),
                      }));

                    if (fresh.length > 0) {
                      this.trades = [...fresh, ...this.trades].slice(0, 50);
                      this.updateTrades();
                    }
                  } catch (err) {
                    console.error('WS parse error', err);
                  }
                };

                this.ws.onclose = () => {
                  this.connected = false;
                  this.updateConnectionStatus();
                };
                this.ws.onerror = () => {
                  this.connected = false;
                  this.updateConnectionStatus();
                };
              }

              render() {
                const root = document.getElementById('whale-watcher-root');
                root.innerHTML = \`
                  <div style="width: 100%; height: 100vh; overflow: hidden; position: relative; background: linear-gradient(to bottom, #111827, #000000, #111827);">
                    <!-- Animated Background -->
                    <div style="position: absolute; inset: 0; overflow: hidden;">
                      \${Array.from({length: 30}, (_, i) => \`
                        <div class="particle" style="
                          position: absolute;
                          border-radius: 50%;
                          width: \${Math.random() > 0.7 ? '8px' : '4px'};
                          height: \${Math.random() > 0.7 ? '8px' : '4px'};
                          background: radial-gradient(circle, \${['rgba(59, 130, 246, 0.8)', 'rgba(147, 51, 234, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 101, 101, 0.8)'][Math.floor(Math.random() * 4)]}, transparent);
                          left: \${Math.random() * 100}%;
                          animation-delay: \${Math.random() * 15}s;
                          animation-duration: \${10 + Math.random() * 8}s;
                          filter: blur(0.5px);
                          box-shadow: 0 0 10px currentColor;
                        "></div>
                      \`).join('')}
                    </div>

                    <!-- Header -->
                    <div class="whale-glow" style="position: relative; padding: 16px; border-bottom: 1px solid rgba(107, 114, 128, 0.5); backdrop-filter: blur(4px); z-index: 10;">
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 600; margin-bottom: 12px;">
                        <span style="font-size: 18px; font-weight: bold; letter-spacing: 0.1em; background: linear-gradient(to right, #60a5fa, #a855f7, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent;">
                          WHALE RADAR
                        </span>
                        <div id="connection-status" style="width: 12px; height: 12px; border-radius: 50%; position: relative; background: #ef4444;">
                          <div style="position: absolute; inset: 0; border-radius: 50%; animation: pulse 2s ease-in-out infinite; background: #ef4444;"></div>
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 12px; color: #d1d5db;">
                        <span style="color: #60a5fa; font-weight: bold;">$\${(this.threshold/1000).toFixed(0)}K</span>
                        <div style="flex: 1; position: relative;">
                          <input
                            type="range"
                            min="50000"
                            max="1000000"
                            step="25000"
                            value="\${this.threshold}"
                            id="threshold-slider"
                            style="width: 100%; height: 8px; background: rgba(107, 114, 128, 0.5); border-radius: 4px; cursor: pointer; accent-color: #3b82f6; transition: all 0.3s; backdrop-filter: blur(4px);"
                          />
                          <div style="position: absolute; top: 0; left: 0; height: 8px; background: linear-gradient(to right, #3b82f6, #a855f7); border-radius: 4px; pointer-events: none; width: \${((this.threshold - 50000) / (1000000 - 50000)) * 100}%;"></div>
                        </div>
                        <span style="color: #a855f7; font-weight: bold;">$1M</span>
                      </div>

                      <select
                        id="asset-filter"
                        style="width: 100%; background: rgba(31, 41, 55, 0.8); border: 1px solid rgba(107, 114, 128, 0.5); color: white; font-size: 12px; padding: 8px; border-radius: 4px; backdrop-filter: blur(4px);"
                      >
                        <option value="ALL">🌊 All Assets</option>
                        <option value="BTC">₿ BTC</option>
                        <option value="ETH">₿ ETH</option>
                        <option value="SOL">₿ SOL</option>
                        <option value="HYPE">₿ HYPE</option>
                      </select>
                    </div>

                    <!-- Trades List -->
                    <div style="flex: 1; overflow-y: auto; height: calc(100vh - 200px);">
                      <div id="trades-container" style="padding: 8px; gap: 4px; display: flex; flex-direction: column;">
                        <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #9ca3af; text-align: center; padding: 16px;">
                          <div class="whale-float">
                            <div style="font-size: 48px; margin-bottom: 12px;">🐋</div>
                            <div style="font-size: 14px;">
                              \${this.connected ? 'Scanning the depths...' : 'Connecting to the ocean...'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                \`;

                // Add event listeners
                document.getElementById('threshold-slider').addEventListener('input', (e) => {
                  this.threshold = parseInt(e.target.value);
                  this.render();
                });

                document.getElementById('asset-filter').addEventListener('change', (e) => {
                  this.assetFilter = e.target.value;
                  this.updateTrades();
                });
              }

              updateConnectionStatus() {
                const status = document.getElementById('connection-status');
                if (status) {
                  status.style.background = this.connected ? '#22c55e' : '#ef4444';
                  status.firstElementChild.style.background = this.connected ? '#22c55e' : '#ef4444';
                }
              }

              updateTrades() {
                const container = document.getElementById('trades-container');
                const filteredTrades = this.trades.filter(t => this.assetFilter === 'ALL' || t.symbol === this.assetFilter);

                if (filteredTrades.length === 0) {
                  container.innerHTML = \`
                    <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #9ca3af; text-align: center; padding: 16px;">
                      <div class="whale-float">
                        <div style="font-size: 48px; margin-bottom: 12px;">🐋</div>
                        <div style="font-size: 14px;">
                          \${this.connected ? 'Scanning the depths...' : 'Connecting to the ocean...'}
                        </div>
                      </div>
                    </div>
                  \`;
                  return;
                }

                container.innerHTML = filteredTrades.map((t, i) => {
                  const isBuy = t.dir === 'B';
                  const isLarge = t.notional > 200000;
                  const timeAgo = this.getTimeAgo(t.receivedAt);

                  return \`
                    <div class="trade-item \${isBuy ? (isLarge ? 'buy-glow' : '') : (isLarge ? 'sell-glow' : '')}" style="
                      display: flex;
                      align-items: center;
                      padding: 12px;
                      border-radius: 8px;
                      position: relative;
                      overflow: hidden;
                      background: linear-gradient(to right, \${isBuy ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}, \${isBuy ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'});
                      border-left: 4px solid \${isBuy ? '#22c55e' : '#ef4444'};
                      margin-bottom: 4px;
                      transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.02) translateY(-1px)'; this.style.filter='brightness(1.05)';" onmouseout="this.style.transform='scale(1)'; this.style.filter='brightness(1)';">

                      <div style="flex: 1; position: relative; z-index: 10;">
                        <div style="font-weight: bold; font-size: 18px; letter-spacing: 0.05em; color: \${isBuy ? '#22c55e' : '#ef4444'}; text-shadow: 0 0 10px currentColor;">
                          \${t.symbol}
                          \${isLarge ? '<span style="margin-left: 8px; font-size: 12px; background: linear-gradient(to right, #fbbf24, #f59e0b); color: black; padding: 2px 8px; border-radius: 12px; font-weight: 800;">🐋 WHALE</span>' : ''}
                        </div>
                        <div style="font-size: 12px; color: #d1d5db; line-height: 1.2; font-weight: 500;">
                          $\${t.notional.toLocaleString()} @ $\${t.price.toLocaleString()}
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                          <div style="font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px; color: \${isBuy ? '#22c55e' : '#ef4444'};">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: \${isBuy ? '#22c55e' : '#ef4444'};"></span>
                            \${isBuy ? 'BUY' : 'SELL'}
                          </div>
                          <div style="font-size: 12px; color: #6b7280; font-weight: 500;">
                            \${timeAgo}
                          </div>
                        </div>
                      </div>
                      <button
                        onclick="navigator.clipboard.writeText('\${t.wallet}')"
                        style="margin-left: 12px; background: linear-gradient(to right, rgba(107, 114, 128, 0.8), rgba(75, 85, 99, 0.8)); color: white; font-size: 12px; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(107, 114, 128, 0.5); backdrop-filter: blur(4px); transition: all 0.2s ease; cursor: pointer;"
                        onmouseover="this.style.background='linear-gradient(to right, #2563eb, #3b82f6)'; this.style.transform='scale(1.1)'; this.style.boxShadow='0 4px 15px rgba(59, 130, 246, 0.4)';"
                        onmouseout="this.style.background='linear-gradient(to right, rgba(107, 114, 128, 0.8), rgba(75, 85, 99, 0.8))'; this.style.transform='scale(1)'; this.style.boxShadow='none';"
                        title="Copy wallet address"
                      >
                        📋
                      </button>
                    </div>
                  \`;
                }).join('');
              }

              getTimeAgo(receivedAt) {
                const seconds = Math.floor((Date.now() - receivedAt) / 1000);
                if (seconds < 60) return \`\${seconds}s ago\`;
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return \`\${minutes}m ago\`;
                const hours = Math.floor(minutes / 60);
                return \`\${hours}h ago\`;
              }
            }

            // Initialize the whale watcher
            new WhaleWatcher();
          </script>
        </body>
        </html>
      `);
      whaleWatcherWindow.document.close();
    }
  };

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const tradeObjectsRef = useRef<Map<string, THREE.Group>>(new Map());
  const audioContextRef = useRef<AudioContext>();
  const particleSystemsRef = useRef<THREE.Points[]>([]);

  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [connected, setConnected] = useState(false);
  const [threshold, setThreshold] = useState(50000);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize 3D scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    scene.fog = new THREE.Fog(0x000011, 50, 200);
    sceneRef.current = scene;    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 30);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Point lights for dramatic effect
    const pointLight1 = new THREE.PointLight(0x00ff88, 2, 100);
    pointLight1.position.set(20, 20, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff0088, 2, 100);
    pointLight2.position.set(-20, -20, 20);
    scene.add(pointLight2);

    // Create central cylinder structure
    const cylinderGeometry = new THREE.CylinderGeometry(8, 8, 100, 32, 1, true);
    const cylinderMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x001122,
      transparent: true,
      opacity: 0.1,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 1.0,
    });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.rotation.x = Math.PI / 2;
    scene.add(cylinder);

    // Create wireframe rings
    for (let i = 0; i < 20; i++) {
      const ringGeometry = new THREE.RingGeometry(5, 12, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i * 0.1, 0.8, 0.5),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.1,
        wireframe: true,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.z = (i - 10) * 8;
      ring.userData = { originalZ: ring.position.z, index: i };
      scene.add(ring);
    }

    // Starfield background
    createStarField(scene);

    // Audio context
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.log('Audio not supported');
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Rotate the scene
      scene.rotation.y += 0.005;

      // Animate rings
      scene.children.forEach((child) => {
        if (child.userData.originalZ !== undefined) {
          child.position.z = child.userData.originalZ + Math.sin(Date.now() * 0.001 + child.userData.index) * 2;
          child.rotation.z += 0.01;
        }
      });

      // Animate trade objects
      tradeObjectsRef.current.forEach((tradeGroup, id) => {
        if (tradeGroup.parent) {
          tradeGroup.position.z -= 0.3;
          tradeGroup.rotation.y += 0.02;
          tradeGroup.scale.multiplyScalar(0.998);

          // Remove if too far
          if (tradeGroup.position.z < -60 || tradeGroup.scale.x < 0.1) {
            scene.remove(tradeGroup);
            tradeObjectsRef.current.delete(id);
          }
        }
      });

      // Animate particles
      particleSystemsRef.current.forEach((particles, index) => {
        if (particles.parent) {
          particles.position.z -= 0.5;
          (particles.material as THREE.PointsMaterial).opacity *= 0.99;

          if (particles.position.z < -80 || (particles.material as THREE.PointsMaterial).opacity < 0.01) {
            scene.remove(particles);
            particleSystemsRef.current.splice(index, 1);
          }
        }
      });

      // Camera movement
      const time = Date.now() * 0.0005;
      camera.position.x = Math.sin(time) * 5;
      camera.position.y = Math.cos(time * 0.7) * 3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
      ['BTC', 'ETH', 'SOL', 'HYPE', 'DOGE', 'LINK', 'UNI', 'AAVE'].forEach(coin =>
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
            id: `${f.coin}-${Date.now()}-${Math.random()}`,
          })) as WhaleTrade[];

        if (fresh.length > 0) {
          setTrades(prev => [...fresh, ...prev].slice(0, 100));
          fresh.forEach(trade => {
            createTradeVisualization(trade);
            playTradeSound(trade);
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

  const createStarField = (scene: THREE.Scene) => {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      transparent: true,
      opacity: 0.8,
    });

    const starVertices = [];
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 400;
      const y = (Math.random() - 0.5) * 400;
      const z = (Math.random() - 0.5) * 400;
      starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
  };

  const createTradeVisualization = (trade: WhaleTrade) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const tradeGroup = new THREE.Group();

    // Trade size affects geometry size
    const sizeMultiplier = Math.min(trade.notional / 50000, 5);
    const isBuy = trade.dir === 'B';

    // Main trade object - different shapes for buy/sell
    let mainGeometry: THREE.BufferGeometry;
    if (isBuy) {
      mainGeometry = new THREE.OctahedronGeometry(1 + sizeMultiplier * 0.5);
    } else {
      mainGeometry = new THREE.IcosahedronGeometry(1 + sizeMultiplier * 0.5);
    }

    const mainMaterial = new THREE.MeshPhysicalMaterial({
      color: isBuy ? 0x00ff88 : 0xff0088,
      emissive: isBuy ? 0x002200 : 0x220000,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });

    const mainMesh = new THREE.Mesh(mainGeometry, mainMaterial);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    tradeGroup.add(mainMesh);

    // Symbol text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 128;
    context.fillStyle = isBuy ? '#00ff88' : '#ff0088';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.fillText(trade.symbol, 128, 64);
    context.font = 'bold 24px Arial';
    context.fillText(`$${(trade.notional / 1000).toFixed(0)}K`, 128, 96);

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(textMaterial);
    sprite.position.y = 3;
    sprite.scale.set(4, 2, 1);
    tradeGroup.add(sprite);

    // Orbital rings
    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.TorusGeometry(2 + i, 0.1, 8, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: isBuy ? 0x00ff88 : 0xff0088,
        transparent: true,
        opacity: 0.3 - i * 0.1,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.random() * Math.PI;
      ring.rotation.y = Math.random() * Math.PI;
      ring.userData = { speed: 0.02 + Math.random() * 0.02 };
      tradeGroup.add(ring);
    }

    // Particle explosion
    createParticleExplosion(scene, isBuy, sizeMultiplier);

    // Position on cylinder surface
    const angle = Math.random() * Math.PI * 2;
    const radius = 10;
    tradeGroup.position.x = Math.cos(angle) * radius;
    tradeGroup.position.y = Math.sin(angle) * radius;
    tradeGroup.position.z = 30;

    // Add rotation
    tradeGroup.userData = {
      rotationSpeed: {
        x: (Math.random() - 0.5) * 0.02,
        y: (Math.random() - 0.5) * 0.02,
        z: (Math.random() - 0.5) * 0.02,
      }
    };

    scene.add(tradeGroup);
    tradeObjectsRef.current.set(trade.id, tradeGroup);
  };

  const createParticleExplosion = (scene: THREE.Scene, isBuy: boolean, sizeMultiplier: number) => {
    const particleCount = Math.floor(50 * sizeMultiplier);
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2;
      positions[i3 + 1] = (Math.random() - 0.5) * 2;
      positions[i3 + 2] = (Math.random() - 0.5) * 2;

      velocities[i3] = (Math.random() - 0.5) * 0.2;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i3 + 2] = -Math.random() * 0.1;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: isBuy ? 0x00ff88 : 0xff0088,
      size: 2 + sizeMultiplier,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    particleSystem.position.z = 30;
    scene.add(particleSystem);
    particleSystemsRef.current.push(particleSystem);
  };

  const playTradeSound = (trade: WhaleTrade) => {
    if (!audioContextRef.current || !isPlaying) return;

    const context = audioContextRef.current;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Frequency based on trade size
    const baseFreq = trade.dir === 'B' ? 440 : 220;
    const sizeMultiplier = Math.log(trade.notional / 10000);
    oscillator.frequency.setValueAtTime(baseFreq * sizeMultiplier, context.currentTime);

    // Volume based on trade size
    const volume = Math.min(trade.notional / 1000000, 0.3);
    gainNode.gain.setValueAtTime(volume, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

    oscillator.type = trade.dir === 'B' ? 'sine' : 'sawtooth';
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.5);
  };

  const toggleAudio = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Scene */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            WHALE RADAR 3D
          </h1>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-cyan-400 mb-1">
              THRESHOLD: ${(threshold / 1000).toFixed(0)}K
            </label>
            <input
              type="range"
              min={50000}
              max={1000000}
              step={25000}
              value={threshold}
              onChange={e => setThreshold(+e.target.value)}
              className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <button
            onClick={toggleAudio}
            className={`w-full py-2 px-4 rounded font-bold transition-all ${
              isPlaying 
                ? 'bg-green-500 text-black hover:bg-green-400' 
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {isPlaying ? '🔊 AUDIO ON' : '🔇 AUDIO OFF'}
          </button>
        </div>
      </div>

      {/* Trade Counter */}
      <div className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-400">{trades.length}</div>
          <div className="text-xs text-gray-400">WHALES DETECTED</div>
        </div>
      </div>

      {/* Recent Trades List */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 max-w-sm max-h-60 overflow-y-auto">
        <h3 className="text-sm font-bold text-cyan-400 mb-2">RECENT WHALES</h3>
        <div className="space-y-1">
          {trades.slice(0, 10).map((trade, i) => (
            <div key={trade.id} className={`text-xs p-2 rounded border-l-2 ${
              trade.dir === 'B' ? 'border-green-400 bg-green-900/20' : 'border-red-400 bg-red-900/20'
            }`}>
              <div className="flex justify-between items-center">
                <span className="font-bold">{trade.symbol}</span>
                <span className={trade.dir === 'B' ? 'text-green-400' : 'text-red-400'}>
                  {trade.dir === 'B' ? 'BUY' : 'SELL'}
                </span>
              </div>
              <div className="text-gray-400">${(trade.notional / 1000).toFixed(0)}K</div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-10 bg-black/70 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-4 text-xs text-gray-400 max-w-xs">
        <div className="space-y-1">
          <div>🐋 <strong>Real-time whale trades</strong></div>
          <div>🔊 <strong>Audio feedback</strong></div>
          <div>🎮 <strong>3D visualization</strong></div>
          <div>⚡ <strong>Live from Hyperliquid</strong></div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [show3D, setShow3D] = useState(false);
  return (
    <>
      {show3D ? (
        <WhaleWatcher3D />
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white overflow-hidden">
          {/* Background Pattern */}
          <div className="fixed inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }} />
          </div>

          <div className="relative z-10 flex h-screen">
            {/* Main Content Area - Better space utilization */}
            <div className="flex-1 flex flex-col mr-4 relative z-10">
              {/* Header - Compact */}
              <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b-2 border-green-500 p-4 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 clip-path-diamond flex items-center justify-center">
                      <span className="text-black font-bold text-sm">⚡</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                      TRADING ANALYTICS
                    </h1>
                  </div>
                  <div className="text-xs text-green-400 font-mono">
                    LIVE DATA
                  </div>
                </div>

                {/* Search Section - Compact */}
                <div className="bg-gradient-to-r from-gray-800/60 to-gray-700/60 border border-green-500/30 rounded p-3 backdrop-blur-sm">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-green-400 mb-1 tracking-wide">
                        WALLET ADDRESS
                      </label>
                      <input
                        value={wallet}
                        onChange={(e) => setWallet(e.target.value.trim())}
                        placeholder="0x... (Enter wallet to analyze)"
                        className="w-full bg-gray-900/80 border border-gray-600 text-white px-3 py-2 rounded font-mono text-sm focus:border-green-500 focus:outline-none transition-all duration-300"
                      />
                    </div>
                    <button
                      onClick={fetchStats}
                      disabled={loading}
                      className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-black px-6 py-2 rounded font-bold tracking-wide disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          ANALYZING
                        </div>
                      ) : 'ANALYZE'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mt-3 bg-red-900/30 border border-red-500 text-red-300 px-3 py-2 rounded text-sm">
                    <span className="font-semibold">ERROR:</span> {error}
                  </div>
                )}
              </div>

              {/* Stats Content - Optimized for single page */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto relative z-10">
                {stats && (
                  <>
                    {/* Overview Stats - Better organized grid */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                        <h2 className="text-lg font-bold tracking-wider text-green-400">OVERVIEW</h2>
                      </div>
                      <div className="grid grid-cols-6 gap-2">
                        <StatCard label="Trades" value={stats.totalTrades.toLocaleString()} />
                        <StatCard label="Win Rate" value={pct(stats.winRate)} />
                        <StatCard label="PnL" value={usd(stats.realizedPnl)} />
                        <StatCard label="Volume" value={usd(stats.volume)} />

                        {/* Trader Rank Section */}
                        <div className="col-span-2 bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-yellow-500/50 rounded p-3 backdrop-blur-sm relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold text-green-400 tracking-wide">
                              TRADER RANK
                            </div>

                            {/* Info Button */}
                            <div className="relative group">
                              <button className="w-5 h-5 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center hover:bg-blue-400 transition-colors">
                                ?
                              </button>

                              {/* Tooltip */}
                              <div className="absolute right-0 top-6 w-80 bg-gray-900 border border-gray-600 rounded-lg p-4 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                <div className="text-sm text-white">
                                  <div className="font-bold text-green-400 mb-2">Rank Calculation</div>
                                  <div className="text-xs text-gray-300 mb-3">Based on trading performance across multiple factors:</div>

                                  <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-yellow-400">Win Rate (40%)</span>
                                      <span className="text-gray-300">40%+ decent, 50%+ great, 60%+ amazing</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-green-400">Total PnL (35%)</span>
                                      <span className="text-gray-300">$100k+ diamond tier</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-400">Risk/Reward (15%)</span>
                                      <span className="text-gray-300">Avg win vs avg loss</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-purple-400">Sample Size (10%)</span>
                                      <span className="text-gray-300">Trade count confidence</span>
                                    </div>
                                  </div>

                                  <div className="border-t border-gray-700 mt-3 pt-3">
                                    <div className="font-bold text-orange-400 mb-2 text-xs">Rank Tiers</div>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-orange-400">🏆 Challenger</span>
                                        <span className="text-gray-300">100+ (Legendary)</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-cyan-400">💎 Diamond</span>
                                        <span className="text-gray-300">80-99 (Elite)</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-300">🏆 Platinum</span>
                                        <span className="text-gray-300">60-79 (Expert)</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-yellow-400">🥇 Gold</span>
                                        <span className="text-gray-300">40-59 (Skilled)</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">🥈 Silver</span>
                                        <span className="text-gray-300">20-39 (Developing)</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-orange-600">🥉 Bronze</span>
                                        <span className="text-gray-300">0-19 (Learning)</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-center">
                            {stats.traderRank ? (
                              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${stats.traderRank.gradient ? `bg-gradient-to-r ${stats.traderRank.gradient}` : 'bg-gradient-to-r from-orange-600 to-red-700'} shadow-lg`}>
                                <div className="flex-shrink-0 text-2xl">
                                  {stats.traderRank.logo || '🥉'}
                                </div>
                                <span className="text-lg font-bold text-white tracking-wider">
                                  {stats.traderRank.displayName || stats.traderRank.name || 'Bronze'}
                                </span>
                              </div>
                            ) : (
                              <div className="bg-gradient-to-r from-orange-600 to-red-700 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg">
                                <div className="flex-shrink-0 text-2xl">🥉</div>
                                <span className="text-lg font-bold text-white tracking-wider">Bronze</span>
                              </div>
                            )}
                          </div>

                          {/* Score display */}
                          {stats.confidenceScore !== undefined && (
                            <div className="text-xs text-gray-400 text-center mt-2">
                              Score: {stats.confidenceScore}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Two-column layout for better space usage */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left Column */}
                      <div className="space-y-4">
                        {/* Long/Short Analysis */}
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                            <h2 className="text-lg font-bold tracking-wider text-green-400">LONG/SHORT ANALYSIS</h2>
                          </div>
                          <div className="space-y-3">
                            <LoadoutCard side="LONG POSITIONS" data={stats.longs} color="green" />
                            <LoadoutCard side="SHORT POSITIONS" data={stats.shorts} color="red" />
                          </div>
                        </section>

                        {/* Additional Stats */}
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                            <h2 className="text-lg font-bold tracking-wider text-green-400">PERFORMANCE METRICS</h2>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <StatCard label="Avg Win" value={usd(stats.avgWin)} />
                            <StatCard label="Avg Loss" value={usd(stats.avgLoss)} />
                            <StatCard label="Total Fees" value={usd(stats.fees)} />
                            <StatCard label="Most Traded" value={stats.mostTraded} />
                          </div>
                        </section>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-4">
                        {/* Time Analysis */}
                        <section>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                            <h2 className="text-lg font-bold tracking-wider text-green-400">TIME PATTERNS</h2>
                          </div>
                          <div className="space-y-3">
                            <TimeCard title="DAILY" type="days" data={stats.timeBreakdown.days} />
                            <TimeCard title="SESSIONS" type="sessions" data={stats.timeBreakdown.sessions} />

                            {/* Hours - Simplified */}
                            <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-3 backdrop-blur-sm">
                              <h3 className="font-bold text-green-400 text-sm tracking-wider mb-2">HOURLY HEATMAP</h3>
                              <div className="grid grid-cols-8 gap-1">
                                {Object.entries(stats.timeBreakdown?.hours || {})
                                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                  .slice(0, 16) // Show more hours
                                  .map(([hour, data]) => {
                                    const getColorClass = () => {
                                      if (data.trades < 3) return 'bg-gray-700/50';
                                      if (data.winRate >= 0.7) return 'bg-green-500';
                                      if (data.winRate >= 0.5) return 'bg-yellow-500';
                                      return 'bg-red-500';
                                    };

                                    return (
                                      <div 
                                        key={hour} 
                                        className={`${getColorClass()} rounded p-1 text-center cursor-help`}
                                        title={`${hour}:00 - ${data.trades} trades, ${(data.winRate * 100).toFixed(0)}% win rate`}
                                      >
                                        <div className="text-xs font-bold text-white">{hour.padStart(2, '0')}</div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>

                    {/* PnL Chart - Compact */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                        <h2 className="text-lg font-bold tracking-wider text-green-400">PERFORMANCE CHART</h2>
                      </div>
                      <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm h-48">
                        <Line
                          height={180}
                          data={{
                            labels: stats.pnlChart.map((_, i) => i),
                            datasets: [
                              {
                                label: 'PnL (USD)',
                                data: stats.pnlChart.map((p) => p.pnl),
                                borderColor: stats.realizedPnl >= 0 ? '#22c55e' : '#ef4444',
                                backgroundColor: stats.realizedPnl >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                fill: true,
                                pointRadius: 0,
                                tension: 0.3,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              x: { ticks: { display: false }, grid: { display: false } },
                              y: {
                                ticks: {
                                  callback: (v) => usd(Number(v)),
                                  color: '#22c55e',
                                  font: { size: 10 }
                                },
                                grid: { color: 'rgba(34,197,94,0.1)' }
                              },
                            },
                          }}
                        />
                      </div>
                    </section>
                  </>
                )}

                {!stats && !loading && (
                  <div className="flex items-center justify-center h-full text-gray-500 relative overflow-hidden">
                    <div className="dvd-bounce absolute">
                      <div className="text-center bg-gradient-to-r from-green-400 to-blue-500 text-black px-4 py-2 rounded-lg font-bold shadow-lg">
                        <div className="text-2xl mb-1">📊</div>
                        <div className="text-sm">Ready to Analyze</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Whale Watcher Sidebar - Optimized width */}
            <div className="w-96 border-l-2 border-green-500 relative flex-shrink-0 z-5">
              <button
                onClick={() => setShow3D(true)}
                className="absolute top-2 right-2 z-20 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-400 transition-colors"
                title="Open in new tab"
              >
                3D
              </button>
              <WhaleWatcher />
            </div>
          </div>

          <style jsx>{`
            .clip-path-diamond {
              clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
            }

            .dvd-bounce {
              animation: dvd-bounce 15s linear infinite;
            }

            @keyframes dvd-bounce {
              0% {
                left: 0%;
                top: 0%;
                transform: translate(0, 0);
              }
              12.5% {
                left: calc(100% - 150px);
                top: 0%;
                transform: translate(0, 0);
              }
              25% {
                left: calc(100% - 150px);
                top: calc(100% - 80px);
                transform: translate(0, 0);
              }
              37.5% {
                left: 0%;
                top: calc(100% - 80px);
                transform: translate(0, 0);
              }
              50% {
                left: 0%;
                top: calc(50% - 40px);
                transform: translate(0, 0);
              }
              62.5% {
                left: calc(50% - 75px);
                top: 0%;
                transform: translate(0, 0);
              }
              75% {
                left: calc(100% - 150px);
                top: calc(25% - 20px);
                transform: translate(0, 0);
              }
              87.5% {
                left: calc(25% - 37px);
                top: calc(100% - 80px);
                transform: translate(0, 0);
              }
              100% {
                left: 0%;
                top: 0%;
                transform: translate(0, 0);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
