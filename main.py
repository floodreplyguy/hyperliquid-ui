from hyperliquid.info import Info
from hyperliquid.utils import constants
import pandas as pd
import matplotlib.pyplot as plt

wallet = "0xecb63caa47c7c4e77f60f1ce858cf28dc2b82b00"
info   = Info(constants.MAINNET_API_URL, skip_ws=True)
print(f"\nAnalyzing wallet: {wallet}")

choice = input("View which trades? (1 = Perp, 2 = Spot): ").strip()
if choice not in {"1", "2"}:
    print("Please enter 1 or 2.")
    quit()
spot_mode = (choice == "2")

rows = []
for f in info.user_fills(wallet):
    coin = f["coin"]
    is_spot = "/" in coin
    if is_spot != spot_mode:
        continue
    rows.append({
        "time": pd.to_datetime(f["time"], unit="ms"),
        "symbol": coin,
        "side": "long" if "Long" in f["dir"] else "short",
        "size": float(f["sz"]),
        "price": float(f["px"]),
        "pnl": float(f.get("closedPnl", 0)),
        "fee": float(f.get("feeUsd", f.get("fee", 0))),
    })

df = pd.DataFrame(rows)
if df.empty:
    print("No matching trades found.")
    quit()

df["notional"] = abs(df["size"] * df["price"])
start, end = df["time"].min(), df["time"].max()
span = end - start
days, secs = span.days, span.seconds
hrs, mins = secs // 3600, (secs % 3600) // 60
wins = df[df["pnl"] > 0]
losses = df[df["pnl"] < 0]

print("\n=== SUMMARY (latest 2 000 fills) ===")
print(f"Total trades       : {len(df):,}")
print(f"Win rate           : {len(wins)/len(df):.1%}")
print(f"Average win        : ${wins['pnl'].mean():,.2f}" if not wins.empty else "Average win        : n/a")
print(f"Average loss       : ${losses['pnl'].mean():,.2f}" if not losses.empty else "Average loss       : n/a")
print(f"Total realized PnL : ${df['pnl'].sum():,.2f}")
print(f"Total volume (USD) : ${df['notional'].sum():,.2f}")
print(f"Fees paid (USD)    : ${df['fee'].sum():,.2f}")
print(f"Avg notional size  : ${df['notional'].mean():,.2f}")
print(f"Most traded coin   : {df['symbol'].mode()[0]}")
print(f"Time range         : {start.strftime('%Y-%m-%d %H:%M:%S')} → {end.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Exact span         : {days} d {hrs:02d}h {mins:02d}m {secs%60:02d}s")

# 30d / 7d / 1d blocks
def block(label, cutoff):
    sub = df[df["time"] >= cutoff]
    if sub.empty:
        return
    w = sub[sub["pnl"] > 0]
    l = sub[sub["pnl"] < 0]
    print(f"\n=== LAST {label.upper()} ===")
    print(f"Trades             : {len(sub):,}")
    print(f"Win rate           : {len(w)/len(sub):.1%}")
    print(f"Avg win            : ${w['pnl'].mean():,.2f}" if not w.empty else "Avg win        : n/a")
    print(f"Avg loss           : ${l['pnl'].mean():,.2f}" if not l.empty else "Avg loss       : n/a")
    print(f"PnL                : ${sub['pnl'].sum():,.2f}")
    print(f"Volume             : ${sub['notional'].sum():,.2f}")
    print(f"Fees               : ${sub['fee'].sum():,.2f}")

if (end - start).days >= 30:
    block("30 d", end - pd.Timedelta(days=30))
if (end - start).days >= 7:
    block("7 d", end - pd.Timedelta(days=7))
if span.total_seconds() >= 86400:
    block("1 d", end - pd.Timedelta(days=1))

# Long vs Short Stats
def print_side_stats(name, df_sub):
    wins = df_sub[df_sub["pnl"] > 0]
    losses = df_sub[df_sub["pnl"] < 0]
    print(f"\n=== {name.upper()} STATS ===")
    print(f"Trades             : {len(df_sub):,}")
    print(f"Win rate           : {len(wins)/len(df_sub):.1%}" if len(df_sub) else "n/a")
    print(f"Average win        : ${wins['pnl'].mean():,.2f}" if not wins.empty else "n/a")
    print(f"Average loss       : ${losses['pnl'].mean():,.2f}" if not losses.empty else "n/a")
    print(f"Total PnL          : ${df_sub['pnl'].sum():,.2f}")
    print(f"Total volume       : ${df_sub['notional'].sum():,.2f}")
    print(f"Fees               : ${df_sub['fee'].sum():,.2f}")
    print(f"Top 3 coins        : {df_sub['symbol'].value_counts().head(3).to_dict()}")

print_side_stats("long", df[df["side"] == "long"])
print_side_stats("short", df[df["side"] == "short"])

# Biggest trades by notional
top5 = df.nlargest(5, "notional")
big_win = df.loc[df["pnl"].idxmax()]
big_loss = df.loc[df["pnl"].idxmin()]

print("\n=== TOP 5 BIGGEST TRADES (Notional) ===")
print(top5[["time","symbol","side","notional","pnl"]].to_string(index=False))

print("\nBiggest winner:")
print(big_win[["time","symbol","side","notional","pnl"]].to_string())

print("\nBiggest loser:")
print(big_loss[["time","symbol","side","notional","pnl"]].to_string())

# Cumulative PnL chart
df_sorted = df.sort_values("time")
df_sorted["cum_pnl"] = df_sorted["pnl"].cumsum()
plt.figure(figsize=(12, 4))
plt.plot(df_sorted["time"], df_sorted["cum_pnl"], linewidth=1.5)
plt.title("Cumulative PnL – Last 2 000 Trades")
plt.xlabel("Time")
plt.ylabel("PnL (USD)")
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig("pnl_chart.png")
print("\n📈 Saved equity curve to 'pnl_chart.png'")
