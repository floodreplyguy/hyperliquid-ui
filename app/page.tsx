
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
            body { margin: 0; background: #111827; }
          </style>
        </head>
        <body>
          <div id="whale-watcher-container">
            <div style="color: white; padding: 20px; text-align: center;">
              Whale Watcher (New Tab)<br>
              <small>Close this tab to return to main app</small>
            </div>
          </div>
        </body>
        </html>
      `);
      whaleWatcherWindow.document.close();
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
        {/* Main Content Area - 75% */}
        <div className="w-3/4 flex flex-col">
          {/* Header - Compact */}
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b-2 border-green-500 p-4">
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
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {stats && (
              <>
                {/* Overview Stats - Compact Grid */}
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
                    <StatCard label="Score" value={`${stats.confidenceScore || 0}%`} highlight={true} />
                    <StatCard label="Streak" value={`${(stats.winStreaks?.current || 0) > 0 ? '+' : ''}${stats.winStreaks?.current || 0}`} />
                  </div>
                </section>

                {/* Long/Short Analysis - Side by side, compact */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                    <h2 className="text-lg font-bold tracking-wider text-green-400">LONG/SHORT ANALYSIS</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <LoadoutCard side="LONG POSITIONS" data={stats.longs} color="green" />
                    <LoadoutCard side="SHORT POSITIONS" data={stats.shorts} color="red" />
                  </div>
                </section>

                {/* Time Analysis - Horizontal layout */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 bg-green-500 clip-path-diamond" />
                    <h2 className="text-lg font-bold tracking-wider text-green-400">TIME PATTERNS</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Days of Week */}
                    <TimeCard title="DAILY" type="days" data={stats.timeBreakdown.days} />
                    
                    {/* Sessions */}
                    <TimeCard title="SESSIONS" type="sessions" data={stats.timeBreakdown.sessions} />
                    
                    {/* Hours - Simplified */}
                    <div className="bg-gradient-to-br from-gray-800/80 to-gray-700/60 border border-green-500/30 rounded p-3 backdrop-blur-sm">
                      <h3 className="font-bold text-green-400 text-sm tracking-wider mb-2">HOURLY</h3>
                      <div className="grid grid-cols-6 gap-1 max-h-20 overflow-y-auto">
                        {Object.entries(stats.timeBreakdown?.hours || {})
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .slice(0, 12) // Show only 12 hours to fit
                          .map(([hour, data]) => {
                            const getColorClass = () => {
                              if (data.trades < 3) return 'bg-gray-700/50';
                              if (data.winRate >= 0.7) return 'bg-green-500';
                              if (data.winRate >= 0.5) return 'bg-yellow-500';
                              return 'bg-red-500';
                            };

                            return (
                              <div key={hour} className={`${getColorClass()} rounded p-1 text-center`}>
                                <div className="text-xs font-bold text-white">{hour.padStart(2, '0')}</div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </section>

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
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <div className="text-lg font-bold">Ready to Analyze</div>
                  <div className="text-sm">Enter a wallet address to begin analysis</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Whale Watcher Sidebar - 25% */}
        <div className="w-1/4 border-l-2 border-green-500 relative">
          <button
            onClick={openWhaleWatcherInNewTab}
            className="absolute top-2 right-2 z-20 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-400 transition-colors"
            title="Open in new tab"
          >
            ↗
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
