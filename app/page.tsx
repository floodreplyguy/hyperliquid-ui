'use client';

import { useState } from 'react';

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
  pnlChart: { trade: number; pnl: number }[];
}

export default function Home() {
  const [wallet, setWallet] = useState('');
  const [type, setType] = useState<'perp' | 'spot'>('perp');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    if (!wallet.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`https://pnl-dna-evansmargintrad.replit.app/stats?wallet=${wallet}&type=${type}`);
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const format = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Hyperliquid Wallet Stats</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        <input
          className="border p-2 rounded w-full md:flex-1"
          placeholder="Enter wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value.trim())}
        />
        <select
          className="border p-2 rounded"
          value={type}
          onChange={(e) => setType(e.target.value as 'perp' | 'spot')}
        >
          <option value="perp">Perp</option>
          <option value="spot">Spot</option>
        </select>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>

      {error && <p className="text-red-600 mb-6">Error: {error}</p>}

      {data && (
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-3">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <Stat label="Total Trades" value={data.totalTrades} />
              <Stat label="Win Rate" value={`${(data.winRate * 100).toFixed(1)}%`} />
              <Stat label="Avg Win" value={`$${format(data.avgWin)}`} />
              <Stat label="Avg Loss" value={`$${format(data.avgLoss)}`} />
              <Stat label="Realized PnL" value={`$${format(data.realizedPnl)}`} />
              <Stat label="Volume" value={`$${format(data.volume)}`} />
              <Stat label="Fees" value={`$${format(data.fees)}`} />
              <Stat label="Avg Notional" value={`$${format(data.avgNotional)}`} />
              <Stat label="Most Traded" value={data.mostTraded} />
            </div>
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">Longs</h2>
            <SideStats stats={data.longs} />
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">Shorts</h2>
            <SideStats stats={data.shorts} />
          </section>

          <section>
            <h2 className="font-bold text-lg mb-2">Biggest Orders</h2>
            <ul className="list-disc list-inside text-sm">
              {data.biggestOrders.map((o, i) => (
                <li key={i}>
                  {o.symbol}: ${format(o.notional)}
                </li>
              ))}
            </ul>
          </section>

          <section className="text-sm">
            <p>
              <strong>Biggest Winner:</strong> {data.biggestWinner.symbol} — ${format(data.biggestWinner.pnl)}
            </p>
            <p>
              <strong>Biggest Loser:</strong> {data.biggestLoser.symbol} — ${format(data.biggestLoser.pnl)}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  );
}

function SideStats({ stats }: { stats: any }) {
  const format = (n: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
      <Stat label="Trades" value={stats.trades} />
      <Stat label="Win Rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
      <Stat label="Avg Win" value={`$${format(stats.avgWin)}`} />
      <Stat label="Avg Loss" value={`$${format(stats.avgLoss)}`} />
      <Stat label="Total PnL" value={`$${format(stats.totalPnl)}`} />
      <Stat label="Volume" value={`$${format(stats.volume)}`} />
      <Stat label="Fees" value={`$${format(stats.fees)}`} />
      <Stat label="Top 3 Symbols" value={Object.entries(stats.top3).map(([s, n]) => `${s} (${n})`).join(', ')} />
    </div>
  );
}
