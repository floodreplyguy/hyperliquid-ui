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
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// 🐳 Whale watcher runs only in the browser (WebSocket, clipboard)
const WhaleWatcher = dynamic(() => import('./whale-watcher'), { ssr: false });

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, TimeScale);

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
            <Stat label="Win Rate" value={pct(stats.winRate)} />
            <Stat label="Avg Win" value={usd(stats.avgWin)} />
            <Stat label="Avg Loss" value={usd(stats.avgLoss)} />
            <Stat label="Realized PnL" value={usd(stats.realizedPnl)} />
            <Stat label="Volume" value={usd(stats.volume)} />
            <Stat label="Fees" value={usd(stats.fees)} />
            <Stat label="Avg Notional" value={usd(stats.avgNotional)} />
            <Stat label="Most Traded" value={stats.mostTraded} />
          </StatsGrid>

          <div className="grid md:grid-cols-2 gap-8">
            <SideCard side="Longs" data={stats.longs} />
            <SideCard side="Shorts" data={stats.shorts} />
          </div>

          <section>
            <h2 className="text-xl font-bold mb-3">Cumulative PnL (last 2 000 trades)</h2>
            <div className="bg-white border rounded p-4">
              <Line
                height={300}
                data={{
                  labels: stats.pnlChart.map((p) => new Date(p.timestamp)),
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
                    x: {
                      type: 'time',
                      time: {
                        unit: 'minute',
                        tooltipFormat: 'MMM d, h:mm a',
                        displayFormats: {
                          minute: 'h:mm a',
                          hour: 'MMM d h a',
                        },
                      },
                      ticks: {
                        maxTicksLimit: 6,
                        autoSkip: true,
                      },
                    },
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
