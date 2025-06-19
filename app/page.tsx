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
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// 🐳 Whale watcher runs only in the browser (WebSocket, clipboard)
const WhaleWatcher = dynamic(() => import('./whale-watcher'), { ssr: false });

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

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
  tradeConfidence: number;
  predictionFactors: {
    overall_win_rate: number;
    recent_win_rate: number;
    recent_pnl_positive: boolean;
    current_streak: number;
    streak_type: string;
    has_good_hours: boolean;
    best_hours: number[];
    best_days: string[];
    best_sessions: string[];
    position_consistency: number;
  };
  timeBreakdown: {
    days: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
    sessions: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
    hours: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
  };
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
      if ((json as any).error) throw new Error((json as any).error);
      setStats(json as ApiResponse);
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
              <p className="text-xs text-gray-500 mb-1">Next Trade Confidence</p>
              <p className={`text-lg font-bold ${
                stats.tradeConfidence >= 70 ? 'text-green-600' : 
                stats.tradeConfidence >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {stats.tradeConfidence}%
              </p>
              <div className="text-xs text-gray-400 mt-1 space-y-1">
                {stats.predictionFactors?.streak_type === 'win' && (stats.predictionFactors?.current_streak || 0) >= 3 && (
                  <p className="text-green-600">🔥 Win streak: {stats.predictionFactors.current_streak}</p>
                )}
                {stats.predictionFactors?.streak_type === 'loss' && (stats.predictionFactors?.current_streak || 0) >= 3 && (
                  <p className="text-red-600">❄️ Loss streak: {stats.predictionFactors.current_streak}</p>
                )}
                {stats.predictionFactors?.best_days && stats.predictionFactors.best_days.length > 0 && (
                  <p className="text-green-600">📅 Best days: {stats.predictionFactors.best_days.join(', ')}</p>
                )}
                {stats.predictionFactors?.best_sessions && stats.predictionFactors.best_sessions.length > 0 && (
                  <p className="text-blue-600">🌍 Best sessions: {stats.predictionFactors.best_sessions.join(', ')}</p>
                )}
                {stats.predictionFactors?.has_good_hours && (
                  <p className="text-purple-600">⏰ Good hours: {stats.predictionFactors.best_hours?.join(', ')}:00 UTC</p>
                )}
                <p>Recent: {((stats.predictionFactors?.recent_win_rate || 0) * 100).toFixed(0)}% wins</p>
              </div>
            </div>
          </StatsGrid>

          <div className="grid md:grid-cols-2 gap-8">
            <SideCard side="Longs" data={stats.longs} />
            <SideCard side="Shorts" data={stats.shorts} />
          </div>

          <section>
            <h2 className="text-xl font-bold mb-3">Time-Based Performance Analysis</h2>
            <div className="grid md:grid-cols-3 gap-6">
              
              {/* Days of Week */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-green-600">📅 Days of Week</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(stats.timeBreakdown?.days || {}).map(([day, data]) => (
                    <div key={day} className="flex justify-between items-center">
                      <span className={`${data.trades >= 10 && data.winRate > 0.55 && data.avgPnl > 0 ? 'font-bold text-green-600' : ''}`}>
                        {day.slice(0, 3)}
                      </span>
                      <div className="text-right">
                        <div>{data.trades} trades</div>
                        <div className={`${data.winRate > 0.55 ? 'text-green-600' : data.winRate < 0.45 ? 'text-red-600' : 'text-gray-600'}`}>
                          {(data.winRate * 100).toFixed(0)}% wins
                        </div>
                        <div className={`${data.avgPnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {usd(data.avgPnl)} avg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trading Sessions */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-blue-600">🌍 Trading Sessions</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(stats.timeBreakdown?.sessions || {}).map(([session, data]) => (
                    <div key={session} className="flex justify-between items-center">
                      <span className={`${data.trades >= 15 && data.winRate > 0.55 && data.avgPnl > 0 ? 'font-bold text-blue-600' : ''}`}>
                        {session}
                      </span>
                      <div className="text-right">
                        <div>{data.trades} trades</div>
                        <div className={`${data.winRate > 0.55 ? 'text-green-600' : data.winRate < 0.45 ? 'text-red-600' : 'text-gray-600'}`}>
                          {(data.winRate * 100).toFixed(0)}% wins
                        </div>
                        <div className={`${data.avgPnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {usd(data.avgPnl)} avg
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-gray-500 mt-2">
                    <div>Asia: 0-8 UTC</div>
                    <div>Europe: 8-16 UTC</div>
                    <div>US: 16-24 UTC</div>
                  </div>
                </div>
              </div>

              {/* Best Hours */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-purple-600">⏰ Hour Performance</h3>
                <div className="space-y-1 text-sm max-h-64 overflow-y-auto">
                  {Object.entries(stats.timeBreakdown?.hours || {})
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([hour, data]) => (
                    <div key={hour} className="flex justify-between items-center">
                      <span className={`${data.trades >= 5 && data.winRate > 0.6 && data.avgPnl > 0 ? 'font-bold text-purple-600' : ''}`}>
                        {hour}:00
                      </span>
                      <div className="text-right">
                        <span className="text-xs">{data.trades}</span>
                        <span className={`ml-2 ${data.winRate > 0.6 ? 'text-green-600' : data.winRate < 0.4 ? 'text-red-600' : 'text-gray-600'}`}>
                          {(data.winRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">Cumulative PnL (last 2 000 trades)</h2>
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
