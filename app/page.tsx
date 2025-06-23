
'use client';

import { useState } from 'react';
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
  winStreaks: { current: number; best: number; worst: number };
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

/* ───────── Main Component ───────── */
export default function Page() {
  const [wallet, setWallet] = useState('');
  const [stats, setStats] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [whaleWatcherExpanded, setWhaleWatcherExpanded] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
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
        {/* Main Content Area - 70% */}
        <div className={`transition-all duration-300 ${whaleWatcherExpanded ? 'w-0 overflow-hidden' : 'w-[70%]'} flex flex-col`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b-2 border-green-500 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-green-500 clip-path-diamond flex items-center justify-center">
                  <span className="text-black font-bold">⚡</span>
                </div>
                <h1 className="text-3xl font-bold tracking-wider bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                  TACTICAL TRADER ANALYSIS
                </h1>
              </div>
              <div className="text-xs text-green-400 font-mono">
                STATUS: OPERATIONAL
              </div>
            </div>

            {/* Search Section */}
            <div className="bg-gradient-to-r from-gray-800/60 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-green-400 mb-2 tracking-wide">
                    TARGET WALLET ADDRESS
                  </label>
                  <input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value.trim())}
                    placeholder="0x... (Enter wallet to analyze)"
                    className="w-full bg-gray-900/80 border border-gray-600 text-white px-4 py-3 rounded font-mono text-sm focus:border-green-500 focus:outline-none transition-all duration-300"
                  />
                </div>
                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-black px-8 py-3 rounded font-bold tracking-wide disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ANALYZING...
                    </div>
                  ) : 'ENGAGE'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded">
                <span className="font-semibold">ERROR:</span> {error}
              </div>
            )}
          </div>

          {/* Stats Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {stats && (
              <div className="p-6 space-y-8">
                {/* Mission Overview */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-6 h-6 bg-green-500 clip-path-diamond" />
                    <h2 className="text-2xl font-bold tracking-wider text-green-400">MISSION OVERVIEW</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <TacticalStat label="Total Engagements" value={stats.totalTrades.toLocaleString()} />
                    <TacticalStat label="Success Rate" value={pct(stats.winRate)} />
                    <TacticalStat label="Avg Victory" value={usd(stats.avgWin)} />
                    <TacticalStat label="Avg Defeat" value={usd(stats.avgLoss)} />
                    <TacticalStat label="Net Operations" value={usd(stats.realizedPnl)} />
                    <TacticalStat label="Total Volume" value={usd(stats.volume)} />
                    <TacticalStat label="Mission Costs" value={usd(stats.fees)} />
                    <TacticalStat label="Avg Payload" value={usd(stats.avgNotional)} />
                    <TacticalStat label="Primary Asset" value={stats.mostTraded} />
                    
                    {/* Confidence Score */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
                      <div className="text-xs font-semibold text-green-400 mb-2 tracking-wide">TACTICAL CONFIDENCE</div>
                      <div className={`text-2xl font-bold mb-1 ${
                        (stats.confidenceScore || 0) >= 70 ? 'text-green-400' : 
                        (stats.confidenceScore || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(stats.confidenceScore || 0)}%
                      </div>
                      <div className="text-xs text-gray-400">
                        {(stats.confidenceScore || 0) >= 70 ? 'ELITE OPERATIVE' :
                         (stats.confidenceScore || 0) >= 50 ? 'CAPABLE SOLDIER' : 'NEEDS TRAINING'}
                      </div>
                    </div>

                    {/* Position Tendency */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
                      <div className="text-xs font-semibold text-green-400 mb-2 tracking-wide">TACTICAL PREFERENCE</div>
                      <div className={`text-sm font-bold mb-1 ${
                        stats.positionTendency === 'Long Bias' ? 'text-green-400' : 
                        stats.positionTendency === 'Short Bias' ? 'text-red-400' : 'text-yellow-400'
                      }`}>
                        {stats.positionTendency}
                      </div>
                      <div className="text-xs text-gray-400">
                        {stats.recentLongs}L / {stats.recentShorts}S
                      </div>
                    </div>

                    {/* Win Streak */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
                      <div className="text-xs font-semibold text-green-400 mb-2 tracking-wide">CURRENT STREAK</div>
                      <div className={`text-sm font-bold mb-1 ${
                        (stats.winStreaks?.current || 0) > 0 ? 'text-green-400' : 
                        (stats.winStreaks?.current || 0) < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {(stats.winStreaks?.current || 0) > 0 ? `+${stats.winStreaks?.current || 0}` : (stats.winStreaks?.current || 0)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(stats.winStreaks?.current || 0) > 0 ? 'ON FIRE' : 
                         (stats.winStreaks?.current || 0) < 0 ? 'NEED BACKUP' : 'NEUTRAL'}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Loadout Analysis */}
                <div className="grid grid-cols-2 gap-6">
                  <LoadoutCard side="LONG OPERATIONS" data={stats.longs} color="green" />
                  <LoadoutCard side="SHORT OPERATIONS" data={stats.shorts} color="red" />
                </div>

                {/* Time-Based Intel */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-6 h-6 bg-green-500 clip-path-diamond" />
                    <h2 className="text-2xl font-bold tracking-wider text-green-400">TEMPORAL INTELLIGENCE</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    {/* Days of Week */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
                      <h3 className="font-bold text-green-400 text-sm tracking-wider mb-4">WEEKLY OPERATIONS</h3>
                      <div className="grid grid-cols-7 gap-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                          const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i];
                          const data = stats.timeBreakdown.days[fullDay] || { trades: 0, winRate: 0, avgPnl: 0 };
                          const getColor = () => {
                            if (data.trades < 3) return 'bg-gray-700/60';
                            if (data.winRate >= 0.7 && data.avgPnl > 0) return 'bg-green-500';
                            if (data.winRate >= 0.6 && data.avgPnl > 0) return 'bg-green-400';
                            if (data.winRate >= 0.5) return 'bg-yellow-500';
                            if (data.winRate >= 0.4) return 'bg-orange-500';
                            return 'bg-red-500';
                          };

                          return (
                            <div key={day} className="text-center">
                              <div className="text-xs text-gray-400 mb-1 font-bold">{day}</div>
                              <div 
                                className={`${getColor()} rounded h-12 flex flex-col justify-center items-center border border-gray-600/30 transition-all hover:scale-105 cursor-pointer`}
                                title={`${fullDay}: ${data.trades} trades, ${(data.winRate * 100).toFixed(0)}% win rate`}
                              >
                                <div className="text-xs font-bold text-white">
                                  {data.trades > 0 ? `${(data.winRate * 100).toFixed(0)}%` : '-'}
                                </div>
                                <div className="text-xs text-white/80">
                                  {data.trades > 0 ? data.trades : '-'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sessions */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
                      <h3 className="font-bold text-green-400 text-sm tracking-wider mb-4">SESSION INTEL</h3>
                      <div className="space-y-3">
                        {['Asia', 'Europe', 'US'].map((session) => {
                          const data = stats.timeBreakdown.sessions[session] || { trades: 0, winRate: 0, avgPnl: 0 };
                          const getColor = () => {
                            if (data.trades < 5) return 'bg-gray-700/60';
                            if (data.winRate >= 0.7 && data.avgPnl > 0) return 'bg-green-500';
                            if (data.winRate >= 0.6 && data.avgPnl > 0) return 'bg-green-400';
                            if (data.winRate >= 0.5) return 'bg-yellow-500';
                            if (data.winRate >= 0.4) return 'bg-orange-500';
                            return 'bg-red-500';
                          };

                          return (
                            <div key={session} className={`${getColor()} rounded p-3 border border-gray-600/30`}>
                              <div className="flex justify-between items-center">
                                <div className="font-bold text-white">{session}</div>
                                <div className="text-sm text-white/80">
                                  {data.trades > 0 ? `${(data.winRate * 100).toFixed(0)}%` : '-'}
                                </div>
                              </div>
                              <div className="text-xs text-white/70 mt-1">
                                {data.trades > 0 ? `${data.trades} ops` : 'No data'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hours */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
                      <h3 className="font-bold text-green-400 text-sm tracking-wider mb-4">HOURLY PATTERNS</h3>
                      <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                        {Object.entries(stats.timeBreakdown?.hours || {})
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([hour, data]) => {
                            const getColorClass = () => {
                              if (data.trades < 3) return 'bg-gray-700/50 border-gray-600';
                              if (data.winRate >= 0.7 && data.avgPnl > 0) return 'bg-green-600/80 border-green-500';
                              if (data.winRate >= 0.6 && data.avgPnl > 0) return 'bg-green-500/60 border-green-400';
                              if (data.winRate >= 0.5) return 'bg-yellow-600/60 border-yellow-500';
                              return 'bg-red-600/80 border-red-500';
                            };

                            return (
                              <div key={hour} className={`${getColorClass()} border rounded p-1 text-center`}>
                                <div className="text-xs font-bold text-white">{hour.padStart(2, '0')}:00</div>
                                <div className="text-xs text-white/80">{data.trades}</div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* PnL Chart */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-6 h-6 bg-green-500 clip-path-diamond" />
                    <h2 className="text-2xl font-bold tracking-wider text-green-400">MISSION PROGRESS</h2>
                  </div>
                  <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-6 backdrop-blur-sm">
                    <Line
                      height={300}
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
                              color: '#22c55e'
                            },
                            grid: { color: 'rgba(34,197,94,0.1)' }
                          },
                        },
                      }}
                    />
                  </div>
                </section>
              </div>
            )}

            {!stats && !loading && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎯</div>
                  <div className="text-xl font-bold">Ready for Mission</div>
                  <div>Enter a wallet address to begin tactical analysis</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Whale Watcher Sidebar - 30% */}
        <div className={`transition-all duration-300 ${whaleWatcherExpanded ? 'w-full' : 'w-[30%]'} border-l-2 border-green-500 relative`}>
          <button
            onClick={() => setWhaleWatcherExpanded(!whaleWatcherExpanded)}
            className="absolute top-4 left-4 z-20 bg-green-500 text-black px-3 py-1 rounded font-bold text-xs hover:bg-green-400 transition-colors"
          >
            {whaleWatcherExpanded ? '◀ MINIMIZE' : '▶ EXPAND'}
          </button>
          <WhaleWatcher />
        </div>
      </div>

      <style jsx>{`
        .clip-path-diamond {
          clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
        }
      `}</style>
    </div>
  );
}

function TacticalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-4 backdrop-blur-sm">
      <div className="text-xs font-semibold text-green-400 mb-2 tracking-wide">{label}</div>
      <div className="text-lg font-bold text-white break-all">{value}</div>
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
    <div className={`bg-gradient-to-br from-gray-800/80 to-gray-700/60 border ${colors.border} rounded p-6 backdrop-blur-sm`}>
      <h3 className={`font-bold text-lg mb-4 ${colors.title} tracking-wider`}>{side}</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-400 mb-1">ENGAGEMENTS</div>
          <div className="text-lg font-bold text-white">{data.trades}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">SUCCESS RATE</div>
          <div className={`text-lg font-bold ${colors.accent}`}>{pct(data.winRate)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">AVG VICTORY</div>
          <div className="text-sm font-bold text-white">{usd(data.avgWin)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">AVG DEFEAT</div>
          <div className="text-sm font-bold text-white">{usd(data.avgLoss)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">NET RESULT</div>
          <div className={`text-sm font-bold ${data.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {usd(data.totalPnl)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">VOLUME</div>
          <div className="text-sm font-bold text-white">{usd(data.volume)}</div>
        </div>
      </div>
    </div>
  );
}
