'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// 👉 Dynamically import the WhaleWatcher so it only runs in the browser
//    (it opens a WebSocket and uses navigator.clipboard)
const WhaleWatcher = dynamic(() => import('./whale-watcher'), { ssr: false });

/* ────────────────────────────────────────────────────────────────────────── *
   DATA MODELS
 * ────────────────────────────────────────────────────────────────────────── */
interface TradeStats {
  trades: number;
  winRate: number; // 0‑1
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
  pnlChart: { trade: number; pnl: number }[];
}

/* ────────────────────────────────────────────────────────────────────────── *
   UTILITIES
 * ────────────────────────────────────────────────────────────────────────── */
const usd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/* ────────────────────────────────────────────────────────────────────────── *
   COMPONENT
 * ────────────────────────────────────────────────────────────────────────── */
export default function Page() {
  const [wallet, setWallet] = useState('');
  const [type, setType] = useState<'perp' | 'spot'>('perp');
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

      // 👇 Replace the hard‑coded URL with your own backend if moved
      const url = `https://pnl-dna-evansmargintrad.replit.app/stats?wallet=${wallet}&type=${type}`;
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
      {/* ── Whale watcher lives in the corner ───────────────────────────── */}
      <WhaleWatcher />

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row gap-4 items-end">
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value.trim())}
          placeholder="Wallet (0x…)"
          className="border rounded px-4 py-2 flex-1"
        />
        <select
          className="border rounded px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as 'perp' | 'spot')}
        >
          <option value="perp">Perp</option>
          <option value="spot">Spot</option>
        </select>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Fetch'}
        </button>
      </section>

      {error && (
        <p className="text-red-600 font-medium">
          Error: {error}
        </p>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      {stats && (
        <div className="space-y-10">
          {/* Overview */}
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

          {/* Long & Short */}
          <div className="grid md:grid-cols-2 gap-8">
            <SideCard side="Longs" data={stats.longs} />
            <SideCard side="Shorts" data={stats.shorts} />
          </div>

          {/* Biggest orders */}
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
              <strong>Biggest Winner:</strong> {stats.biggestWinner.symbol} —{' '}
              {usd(stats.biggestWinner.pnl)}
            </p>
            <p>
              <strong>Biggest Loser:</strong> {stats.biggestLoser.symbol} —{' '}
              {usd(stats.biggestLoser.pnl)}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────── *
   SMALL PRESENTATIONAL COMPONENTS
 * ────────────────────────────────────────────────────────────────────────── */
function StatsGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        {children}
      </div>
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
      <h3 className={`font-bold text-lg mb-2 ${side === 'Longs' ? 'text-green-600' : 'text-red-600'}`}>
        {side}
      </h3>
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
