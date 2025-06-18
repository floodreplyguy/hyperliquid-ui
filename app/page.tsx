'use client';

import { useState } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

interface WalletStats {
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
  longs: {
    trades: number;
    winRate: number;
    totalPnl: number;
    volume: number;
    fees: number;
  };
  shorts: {
    trades: number;
    winRate: number;
    totalPnl: number;
    volume: number;
    fees: number;
  };
  biggestOrders: Array<{ symbol: string; notional: number }>;
  biggestWinner: { symbol: string; pnl: number };
  biggestLoser: { symbol: string; pnl: number };
  pnlChart: Array<{ trade: number; pnl: number }>;
}

/** Vercel → Settings → Environment Variables  
 *  FRONTEND_API = https://pnl-dna-evansmargintrad.replit.app
 */
const BASE_URL = process.env.NEXT_PUBLIC_FRONTEND_API ?? '';

export default function Home() {
  const [walletAddress, setWalletAddress] = useState('');
  const [tradingMode, setTradingMode] = useState<'perp' | 'spot'>('perp');
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidAddress = (addr: string) => addr.startsWith('0x') && addr.length >= 40;

  const fetchWalletStats = async () => {
    if (!isValidAddress(walletAddress)) {
      setError('Enter a valid EVM address'); return;
    }
    setIsLoading(true); setError(''); setStats(null);

    try {
      const spot = tradingMode === 'spot' ? 'true' : 'false';
      const url  = `${BASE_URL}/api/wallet/${walletAddress}?spot=${spot}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Fetch failed');
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------- helpers ---------- */
  const usd = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  const large = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M`
                          : v >= 1e3 ? `$${(v / 1e3).toFixed(2)}K`
                          : usd(v));

  const pnlColor = (v: number) => (v >= 0 ? 'text-green-600' : 'text-red-600');

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold">Hyperliquid Trading Analytics</h1>
          <p className="text-gray-600">Analyze any wallet’s last 2 000 fills</p>
        </header>

        {/* controls */}
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <input
            className="w-full px-4 py-3 border rounded-lg"
            placeholder="0xABC…"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value.trim())}
          />
          <div className="flex gap-2">
            {(['perp', 'spot'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTradingMode(m)}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  tradingMode === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {m === 'perp' ? 'Perpetuals' : 'Spot'}
              </button>
            ))}
            <button
              onClick={fetchWalletStats}
              disabled={isLoading}
              className="ml-auto px-8 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Loading…' : 'Analyze'}
            </button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </section>

        {/* results */}
        {stats && (
          <>
            {/* overview */}
            <StatsGrid stats={stats} usd={usd} large={large} pnlColor={pnlColor} />

            {/* longs / shorts */}
            <SideBreakdown stats={stats} usd={usd} large={large} pnlColor={pnlColor} />

            {/* orders & winners */}
            <Notables stats={stats} large={large} usd={usd} pnlColor={pnlColor} />

            {/* chart */}
            <ChartSection stats={stats} usd={usd} pnlColor={pnlColor} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- tiny presentational helpers ---------- */

function StatCard({ label, value, color = 'text-gray-900' }: any) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function StatsGrid({ stats, usd, large, pnlColor }: any) {
  const o = stats.overall;
  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Trades" value={o.totalTrades.toLocaleString()} />
        <StatCard label="Win Rate" value={`${o.winRatePercent}%`} color={o.winRatePercent>=50?'text-green-600':'text-red-600'}/>
        <StatCard label="Total PnL" value={usd(o.totalPnl)} color={pnlColor(o.totalPnl)}/>
        <StatCard label="Volume" value={large(o.totalVolume)} />
        <StatCard label="Avg Win" value={usd(o.avgWin)} color="text-green-600"/>
        <StatCard label="Avg Loss" value={usd(o.avgLoss)} color="text-red-600"/>
        <StatCard label="Fees" value={usd(o.feesPaid)} />
        <StatCard label="Range" value={`${o.timeStart} – ${o.timeEnd}`} />
      </div>
    </section>
  );
}

function SideBreakdown({ stats, usd, large, pnlColor }: any) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {(['longs','shorts'] as const).map((side)=>
        <section key={side} className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-3 capitalize">{side}</h3>
          {['trades','winRate','totalPnl','volume','fees'].map((k)=>(
            <div key={k} className="flex justify-between text-sm py-1 border-b">
              <span className="text-gray-600">{k.replace(/([A-Z])/g,' $1')}:</span>
              <span className={k==='totalPnl'?pnlColor(stats[side][k]):''}>
                {k==='winRate'?`${(stats[side][k]*100).toFixed(1)}%`
                  :k==='volume'?large(stats[side][k])
                  :usd(stats[side][k])}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Notables({ stats, large, usd, pnlColor }: any) {
  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Notable Trades</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {/* biggest orders */}
        <div>
          <h3 className="font-semibold mb-2">Biggest Orders</h3>
          {stats.biggestOrders.map((o: any, i: number)=>(
            <div key={i} className="flex justify-between py-1 text-sm border-b">
              <span>{o.symbol}</span><span>{large(o.notional)}</span>
            </div>
          ))}
        </div>
        {/* winner / loser */}
        <div>
          <h3 className="font-semibold mb-2">Best & Worst</h3>
          {[
            {t:'Winner',d:stats.biggestWinner,c:'text-green-600'},
            {t:'Loser',d:stats.biggestLoser,c:'text-red-600'}
           ].map(({t,d,c})=>(
             <div key={t} className="flex justify-between py-2 text-sm">
               <span>{t}:</span>
               <span className={c}>{d.symbol} {usd(d.pnl)}</span>
             </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChartSection({ stats, usd, pnlColor }: any) {
  const pnlArr = stats.pnlChart.map((p:any)=>p.pnl);
  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Cumulative PnL</h2>
      <div className="h-80">
        <Line
          data={{
            labels: stats.pnlChart.map((_:any,i:number)=>i+1),
            datasets:[{
              data: pnlArr,
              label: 'PnL',
              borderColor: pnlColor(stats.overall.totalPnl).replace('text-',''),
              backgroundColor: pnlArr[pnlArr.length-1]>=0?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',
              fill:true,tension:.15,pointRadius:0
            }]}
          }
          options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}}
        />
      </div>
    </section>
  );
}
