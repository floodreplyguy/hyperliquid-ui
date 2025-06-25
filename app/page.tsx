'use client';

import { useState, useEffect, useRef } from 'react';
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

  

  return (
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
      );
    }
