'use client';

import { useState } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip);

type StatsResponse = {
  overall: {
    totalTrades: number;
    winRatePercent: number;
    avgWin: number;
    avgLoss: number;
    totalPnl: number;
    totalVolume: number;
    feesPaid: number;
    timeStart: string;
    timeEnd: string;
  };
  longs: Record<string, unknown>;
  shorts: Record<string, unknown>;
  biggestOrders: { symbol: string; notional: number }[];
  biggestWinner: { symbol: string; pnl: number };
  biggestLoser: { symbol: string; pnl: number };
  pnlChart: { trade: number; pnl: number }[];
};

export default function Home() {
  const [wallet, setWallet] = useState('');
  const [side, setSide] = useState<'perp' | 'spot'>('perp');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    if (!wallet) return;
    setLoading(true);
    setError('');
    setStats(null);
    try {
      const res = await fetch(
        `https://pnl-dna-evansmargintrad.replit.app/stats?wallet=${wallet}&type=${side}`
      );
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch');
    }
    setLoading(false);
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Hyperliquid Wallet Stats</h1>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <input
          className="border px-3 py-2 w-full md:flex-1 rounded"
          placeholder="Paste wallet address..."
          value={wallet}
          onChange={(e) => setWallet(e.target.value.trim())}
        />

        <div className="flex gap-2">
          <button
            onClick={() => setSide('spot')}
            className={`px-4 py-2 rounded border ${
              side === 'spot' ? 'bg-black text-white' : ''
            }`}
          >
            Spot
          </button>
          <button
            onClick={() => setSide('perp')}
            className={`px-4 py-2 rounded border ${
              side === 'perp' ? 'bg-black text-white' : ''
            }`}
          >
            Perp
          </button>
        </div>

        <button
          onClick={fetchStats}
          disabled={!wallet || loading}
          className="px-5 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Fetch'}
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {/* Stats */}
      {stats && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Stat label="Total Trades" value={stats.overall.totalTrades} />
            <Stat label="Win Rate" value={`${stats.overall.winRatePercent}%`} />
            <Stat
              label="Average Win"
              value={`$${stats.overall.avgWin.toFixed(2)}`}
            />
            <Stat
              label="Average Loss"
              value={`$${stats.overall.avgLoss.toFixed(2)}`}
            />
            <Stat
              label="Total PnL"
              value={`$${stats.overall.totalPnl.toFixed(2)}`}
            />
            <Stat
              label="Total Volume"
              value={`$${stats.overall.totalVolume.toFixed(2)}`}
            />
            <Stat
              label="Fees Paid"
              value={`$${stats.overall.feesPaid.toFixed(2)}`}
            />
            <Stat
              label="Time Range"
              value={`${stats.overall.timeStart} → ${stats.overall.timeEnd}`}
            />
          </section>

          {/* Biggest Trades */}
          <section className="mt-6">
            <h2 className="font-bold mb-2">Biggest Orders (Notional)</h2>
            <ul className="list-disc list-inside text-sm space-y-1">
              {stats.biggestOrders.map((o, i) => (
                <li key={i}>
                  {o.symbol} – ${o.notional.toFixed(2)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <strong>Biggest Winner:</strong>{' '}
              {stats.biggestWinner.symbol} ${stats.biggestWinner.pnl.toFixed(2)}
            </p>
            <p className="text-sm">
              <strong>Biggest Loser:</strong>{' '}
              {stats.biggestLoser.symbol} ${stats.biggestLoser.pnl.toFixed(2)}
            </p>
          </section>

          {/* PnL Chart */}
          <section className="mt-8">
            <h2 className="font-bold mb-2">PnL Chart (Last 2 000 trades)</h2>
            <Line
              data={{
                labels: stats.pnlChart.map((_, i) => i + 1),
                datasets: [
                  {
                    label: 'PnL (USD)',
                    data: stats.pnlChart.map((p) => p.pnl),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37,99,235,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { display: false } },
              }}
            />
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-4">
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  );
}
