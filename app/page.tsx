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

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-10 relative">
      <WhaleWatcher />

      <section className="flex flex-col md:flex-row gap-4 items-end">
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value.trim())}
          placeholder="Wallet (0x…)"
          className="border rounded px-4 py-2 flex-1"
        />
        <button
          onClick={fetchStats}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Fetch'}
        </button>
      </section>

      {error && <p className="text-red-600 font-medium">Error: {error}</p>}

      {stats && (
        <div className="space-y-10">
          <StatsGrid title="Overview">
            <Stat label="Total Trades" value={stats.totalTrades} />
            <Stat label="Win Rate" value={pct(stats.winRate)} />
            <Stat label="Avg Win" value={usd(stats.avgWin)} />
            <Stat label="Avg Loss" value={usd(stats.avgLoss)} />
            <Stat label="Realized PnL" value={usd(stats.realizedPnl)} />
            <Stat label="Volume" value={usd(stats.volume)} />
            <Stat label="Fees" value={usd(stats.fees)} />
            <Stat label="Avg Notional" value={usd(stats.avgNotional)} />
            <Stat label="Most Traded" value={stats.mostTraded} />
            <div className="border rounded p-3 bg-white">
              <p className="text-xs text-gray-500 mb-1">🎯 Whale Confidence Score</p>
              <p className={`text-2xl font-bold ${
                (stats.confidenceScore || 0) >= 70 ? 'text-green-600' : 
                (stats.confidenceScore || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {(stats.confidenceScore || 0)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {(stats.confidenceScore || 0) >= 70 ? 'High confidence' :
                 (stats.confidenceScore || 0) >= 50 ? 'Medium confidence' : 'Low confidence'}
              </p>
            </div>
            <div className="border rounded p-3 bg-white">
              <p className="text-xs text-gray-500 mb-1">Position Tendency (Last 100)</p>
              <p className={`text-base font-medium ${
                stats.positionTendency === 'Long Bias' ? 'text-green-600' : 
                stats.positionTendency === 'Short Bias' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {stats.positionTendency}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {stats.recentLongs}L / {stats.recentShorts}S
              </p>
            </div>
            <div className="border rounded p-3 bg-white">
              <p className="text-xs text-gray-500 mb-1">🔥 Current Win Streak</p>
              <p className={`text-base font-medium ${
                (stats.winStreaks?.current || 0) > 0 ? 'text-green-600' : 
                (stats.winStreaks?.current || 0) < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {(stats.winStreaks?.current || 0) > 0 ? `+${stats.winStreaks?.current || 0}` : (stats.winStreaks?.current || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {(stats.winStreaks?.current || 0) > 0 ? 'Winning streak' : 
                 (stats.winStreaks?.current || 0) < 0 ? 'Losing streak' : 'No streak'}
              </p>
            </div>
          </StatsGrid>

          <div className="grid md:grid-cols-2 gap-8">
            <SideCard side="Longs" data={stats.longs} />
            <SideCard side="Shorts" data={stats.shorts} />
          </div>

          <section>
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
              Time-Based Performance Analysis
            </h2>
            <div className="grid md:grid-cols-3 gap-6">

              {/* Days of Week */}
              <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <h3 className="font-bold text-blue-400 text-sm tracking-wider">DAYS OF WEEK</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {Object.entries(stats.timeBreakdown?.days || {}).length > 0 ? (
                      Object.entries(stats.timeBreakdown.days).map(([day, data]) => (
                        <div key={day} className="flex justify-between items-center py-2 border-b border-gray-700/30 last:border-b-0">
                          <span className={`font-medium ${data.trades >= 10 && data.winRate > 0.55 && data.avgPnl > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                            {day}
                          </span>
                          <div className="text-right space-y-1">
                            <div className="text-gray-400 text-xs">{data.trades} trades</div>
                            <div className={`text-xs font-bold ${data.winRate > 0.55 ? 'text-green-400' : data.winRate < 0.45 ? 'text-red-400' : 'text-gray-400'}`}>
                              {(data.winRate * 100).toFixed(0)}% wins
                            </div>
                            <div className={`text-xs ${data.avgPnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {usd(data.avgPnl)} avg
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-8">No data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Trading Sessions */}
              <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-cyan-400" />
                    <h3 className="font-bold text-cyan-400 text-sm tracking-wider">TRADING SESSIONS</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {Object.entries(stats.timeBreakdown?.sessions || {}).length > 0 ? (
                      Object.entries(stats.timeBreakdown.sessions).map(([session, data]) => (
                        <div key={session} className="flex justify-between items-center py-2 border-b border-gray-700/30 last:border-b-0">
                          <div>
                            <span className={`font-medium block ${data.trades >= 10 && data.winRate > 0.55 && data.avgPnl > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                              {session}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {session === 'Asia' && '0-8 UTC'}
                              {session === 'Europe' && '8-16 UTC'}
                              {session === 'US' && '16-24 UTC'}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-gray-400 text-xs">{data.trades} trades</div>
                            <div className={`text-xs font-bold ${data.winRate > 0.55 ? 'text-green-400' : data.winRate < 0.45 ? 'text-red-400' : 'text-gray-400'}`}>
                              {(data.winRate * 100).toFixed(0)}% wins
                            </div>
                            <div className={`text-xs ${data.avgPnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {usd(data.avgPnl)} avg
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-8">No data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hour Performance */}
              <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                    <h3 className="font-bold text-purple-400 text-sm tracking-wider">HOUR PERFORMANCE</h3>
                  </div>
                  <div className="space-y-2 text-xs max-h-80 overflow-y-auto custom-scrollbar">
                    {Object.entries(stats.timeBreakdown?.hours || {}).length > 0 ? (
                      Object.entries(stats.timeBreakdown.hours)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([hour, data]) => (
                          <div key={hour} className="flex justify-between items-center py-2 px-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className={`font-medium ${data.trades >= 5 && data.winRate > 0.55 && data.avgPnl > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                              {hour.padStart(2, '0')}:00
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400">{data.trades}</span>
                              <div className={`w-8 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                                data.winRate > 0.55 ? 'bg-green-400/20 text-green-400' : 
                                data.winRate < 0.45 ? 'bg-red-400/20 text-red-400' : 
                                'bg-gray-600/20 text-gray-400'
                              }`}>
                                {(data.winRate * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-gray-500 text-center py-8">No data available</div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </section>

          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: rgba(75, 85, 99, 0.1);
              border-radius: 2px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(147, 51, 234, 0.5);
              border-radius: 2px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(147, 51, 234, 0.7);
            }
          `}</style>

          {stats.openPositions && stats.openPositions.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-3">Open Positions</h2>
              <div className="bg-white border rounded p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Symbol</th>
                        <th className="text-left p-2">Side</th>
                        <th className="text-right p-2">Size</th>
                        <th className="text-right p-2">Entry Price</th>
                        <th className="text-right p-2">Unrealized PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.openPositions.map((pos, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-medium">{pos.symbol}</td>
                          <td className={`p-2 font-medium ${pos.side === 'long' ? 'text-green-600' : 'text-red-600'}`}>
                            {pos.side.toUpperCase()}
                          </td>
                          <td className="p-2 text-right">{Math.abs(pos.size).toFixed(4)}</td>
                          <td className="p-2 text-right">{usd(pos.entryPrice)}</td>
                          <td className={`p-2 text-right font-medium ${pos.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {usd(pos.unrealizedPnl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-bold mb-3">Cumulative PnL (last 2 000 trades)</h2>
            <div className="bg-white border rounded p-4">
              <Line
                height={300}
                data={{
                  labels: stats.pnlChart.map((_, i) => i),
                  datasets: [
                    {
                      label: 'PnL (USD)',
                      data: stats.pnlChart.map((p) => p.pnl),
                      borderColor: stats.realizedPnl >= 0 ? '#16a34a' : '#dc2626',
                      backgroundColor: stats.realizedPnl >= 0 ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
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
                        callback: (v) => usd(Number(v))
                      },
                    },
                  },
                }}
              />
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-3">Biggest Orders (Notional)</h2>
            <ul className="list-disc list-inside text-sm space-y-1">
              {stats.biggestOrders.map((o, i) => (
                <li key={i}>
                  {o.symbol}: {usd(o.notional)}
                </li>
              ))}
            </ul>
          </section>

          <section className="text-sm space-y-1">
            <p>
              <strong>Biggest Winner:</strong> {stats.biggestWinner.symbol} — {usd(stats.biggestWinner.pnl)}
            </p>
            <p>
              <strong>Biggest Loser:</strong> {stats.biggestLoser.symbol} — {usd(stats.biggestLoser.pnl)}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function StatsGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3 bg-white">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-base font-medium break-all">{value}</p>
    </div>
  );
}

function SideCard({ side, data }: { side: 'Longs' | 'Shorts'; data: TradeStats }) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm space-y-2 text-sm">
      <h3 className={`font-bold text-lg mb-2 ${side === 'Longs' ? 'text-green-600' : 'text-red-600'}`}>{side}</h3>
      <Stat label="Trades" value={data.trades} />
      <Stat label="Win Rate" value={pct(data.winRate)} />
      <Stat label="Avg Win" value={usd(data.avgWin)} />
      <Stat label="Avg Loss" value={usd(data.avgLoss)} />
      <Stat label="Total PnL" value={usd(data.totalPnl)} />
      <Stat label="Volume" value={usd(data.volume)} />
      <Stat label="Fees" value={usd(data.fees)} />
      <Stat
        label="Top 3 Symbols"
        value={Object.entries(data.top3)
          .map(([sym, n]) => `${sym} (${n})`)
          .join(', ')}
      />
    </div>
  );
}
