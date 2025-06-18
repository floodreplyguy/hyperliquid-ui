from flask import Flask, request, jsonify
from flask_cors import CORS
from hyperliquid.info import Info
from hyperliquid.utils import constants
import pandas as pd

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

@app.route("/stats")
def stats():
    wallet = request.args.get("wallet")
    trade_type = request.args.get("type")

    if not wallet or trade_type not in {"perp", "spot"}:
        return jsonify({"error": "Missing wallet or invalid type"}), 400

    info = Info(constants.MAINNET_API_URL, skip_ws=True)
    rows = []
    for f in info.user_fills(wallet):
        coin = f["coin"]
        is_spot = "/" in coin
        if (trade_type == "spot") != is_spot:
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
        return jsonify({"error": "No matching trades found"}), 404

    df["notional"] = abs(df["size"] * df["price"])
    df_sorted = df.sort_values("time")
    df_sorted["cum_pnl"] = df_sorted["pnl"].cumsum()
    pnl_chart = [{"trade": i + 1, "pnl": pnl} for i, pnl in enumerate(df_sorted["cum_pnl"].tolist())]

    longs = df[df["side"] == "long"]
    shorts = df[df["side"] == "short"]

    def side_stats(df_sub):
        return {
            "trades": len(df_sub),
            "winRate": float((df_sub["pnl"] > 0).mean()),
            "avgWin": df_sub[df_sub["pnl"] > 0]["pnl"].mean() if not df_sub[df_sub["pnl"] > 0].empty else 0,
            "avgLoss": df_sub[df_sub["pnl"] < 0]["pnl"].mean() if not df_sub[df_sub["pnl"] < 0].empty else 0,
            "totalPnl": df_sub["pnl"].sum(),
            "volume": df_sub["notional"].sum(),
            "fees": df_sub["fee"].sum(),
            "top3": df_sub["symbol"].value_counts().head(3).to_dict(),
        }

    return jsonify({
        "totalTrades": len(df),
        "winRate": float((df["pnl"] > 0).mean()),
        "avgWin": df[df["pnl"] > 0]["pnl"].mean() if not df[df["pnl"] > 0].empty else 0,
        "avgLoss": df[df["pnl"] < 0]["pnl"].mean() if not df[df["pnl"] < 0].empty else 0,
        "realizedPnl": df["pnl"].sum(),
        "volume": df["notional"].sum(),
        "fees": df["fee"].sum(),
        "avgNotional": df["notional"].mean(),
        "mostTraded": df["symbol"].mode()[0],
        "longs": side_stats(longs),
        "shorts": side_stats(shorts),
        "biggestOrders": df.nlargest(5, "notional")[["symbol", "notional"]].to_dict(orient="records"),
        "biggestWinner": df.loc[df["pnl"].idxmax()][["symbol", "pnl"]].to_dict(),
        "biggestLoser": df.loc[df["pnl"].idxmin()][["symbol", "pnl"]].to_dict(),
        "pnlChart": pnl_chart
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
