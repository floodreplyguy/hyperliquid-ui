
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from hyperliquid.info import Info
from hyperliquid.utils import constants
import pandas as pd
import json
from datetime import datetime
import os

app = Flask(__name__, static_folder='my-app/out', static_url_path='')
CORS(app)

info = Info(constants.MAINNET_API_URL, skip_ws=True)

@app.route('/stats')
def stats():
    wallet = request.args.get("wallet")
    trade_type = request.args.get("type")

    if not wallet or trade_type not in {"perp", "spot"}:
        return jsonify({"error": "Missing wallet or invalid type"}), 400

    try:
        spot_mode = trade_type == 'spot'
        
        # Get raw data from hyperliquid
        fills = info.user_fills(wallet)
        
        print(f"DEBUG: Got {len(fills)} fills from API")
        
        # Filter trades based on type FIRST
        trades = []
        for f in fills:
            coin = f["coin"]
            is_spot = "/" in coin
            if is_spot != spot_mode:
                continue
                
            trades.append({
                "time": f["time"],
                "symbol": coin,
                "side": "long" if "Long" in f["dir"] else "short",
                "size": float(f["sz"]),
                "price": float(f["px"]),
                "pnl": float(f.get("closedPnl", 0)),
                "fee": float(f.get("feeUsd", f.get("fee", 0))),
                "notional": abs(float(f["sz"]) * float(f["px"]))
            })

        if not trades:
            return jsonify({"error": "No matching trades found"}), 404

        print(f"DEBUG: Found {len(trades)} trades after filtering")
        
        # Get current positions for unrealized PnL (only for perp)
        open_positions = []
        total_unrealized_pnl = 0
        if not spot_mode:
            try:
                user_state = info.user_state(wallet)
                print(f"DEBUG: User state keys: {user_state.keys() if user_state else 'None'}")
                if user_state and 'assetPositions' in user_state:
                    print(f"DEBUG: Found {len(user_state['assetPositions'])} asset positions")
                    for i, pos in enumerate(user_state['assetPositions']):
                        print(f"DEBUG: Position {i}: {pos}")
                        position_info = pos.get('position', {})
                        if position_info and float(position_info.get('szi', 0)) != 0:
                            unrealized = float(position_info.get('unrealizedPnl', 0))
                            # Try multiple ways to get the symbol
                            symbol = pos.get('coin') or pos.get('symbol') or position_info.get('coin') or position_info.get('symbol') or 'Unknown'
                            print(f"DEBUG: Position symbol: {symbol}, size: {position_info.get('szi', 0)}")
                            open_positions.append({
                                'symbol': symbol,
                                'size': float(position_info.get('szi', 0)),
                                'entryPrice': float(position_info.get('entryPx', 0)),
                                'unrealizedPnl': unrealized,
                                'side': 'long' if float(position_info.get('szi', 0)) > 0 else 'short'
                            })
                            total_unrealized_pnl += unrealized
            except Exception as e:
                print(f"Warning: Could not fetch positions: {e}")
            
            # If no positions found via API, calculate from trade history
            if not open_positions:
                print("No positions from API, calculating from trade history...")
                
                # Calculate net position per symbol
                symbol_positions = {}
                for trade in trades:
                    symbol = trade["symbol"]
                    if symbol not in symbol_positions:
                        symbol_positions[symbol] = {
                            'net_size': 0.0,
                            'total_cost': 0.0,
                            'trades': []
                        }
                    
                    size = trade["size"]
                    if trade["side"] == "short":
                        size = -size
                    
                    symbol_positions[symbol]['net_size'] += size
                    symbol_positions[symbol]['total_cost'] += size * trade["price"]
                    symbol_positions[symbol]['trades'].append(trade)
                
                # Get current market prices
                try:
                    all_mids = info.all_mids()
                    
                    for symbol, pos_data in symbol_positions.items():
                        net_size = pos_data['net_size']
                        if abs(net_size) < 0.0001:  # No meaningful position
                            continue
                        
                        # Calculate average entry price
                        if net_size != 0:
                            avg_entry_price = pos_data['total_cost'] / net_size
                        else:
                            continue
                        
                        # Get current market price
                        current_price = None
                        if symbol in all_mids:
                            current_price = float(all_mids[symbol])
                        else:
                            # Try to get the latest trade price as fallback
                            symbol_trades = [t for t in trades if t["symbol"] == symbol]
                            if symbol_trades:
                                current_price = symbol_trades[-1]["price"]
                        
                        if current_price is None:
                            print(f"Could not get current price for {symbol}")
                            continue
                        
                        # Calculate unrealized PnL
                        unrealized_pnl = net_size * (current_price - avg_entry_price)
                        
                        open_positions.append({
                            'symbol': symbol,
                            'size': abs(net_size),
                            'entryPrice': avg_entry_price,
                            'unrealizedPnl': unrealized_pnl,
                            'side': 'long' if net_size > 0 else 'short'
                        })
                        total_unrealized_pnl += unrealized_pnl
                        
                        print(f"Calculated position for {symbol}: size={net_size}, entry=${avg_entry_price:.2f}, current=${current_price:.2f}, uPnL=${unrealized_pnl:.2f}")
                
                except Exception as e:
                    print(f"Error calculating positions from trade history: {e}")
                    open_positions = []
                    total_unrealized_pnl = 0

        # Sort by time
        trades.sort(key=lambda x: x["time"])
        
        # Calculate cumulative PnL
        cum_pnl = 0
        pnl_chart = []
        for i, trade in enumerate(trades):
            cum_pnl += trade["pnl"]
            pnl_chart.append({"timestamp": trade["time"], "pnl": cum_pnl})

        # Separate longs and shorts
        longs = [t for t in trades if t["side"] == "long"]
        shorts = [t for t in trades if t["side"] == "short"]

        def calculate_side_stats(side_trades):
            if not side_trades:
                return {
                    "trades": 0,
                    "winRate": 0.0,
                    "avgWin": 0.0,
                    "avgLoss": 0.0,
                    "totalPnl": 0.0,
                    "volume": 0.0,
                    "fees": 0.0,
                    "top3": {}
                }
            
            winners = [t for t in side_trades if t["pnl"] > 0]
            losers = [t for t in side_trades if t["pnl"] < 0]
            
            # Calculate symbol counts
            symbol_counts = {}
            for t in side_trades:
                symbol = t["symbol"]
                symbol_counts[symbol] = symbol_counts.get(symbol, 0) + 1
            
            # Get top 3 symbols
            top3 = dict(sorted(symbol_counts.items(), key=lambda x: x[1], reverse=True)[:3])
            
            total_pnl = sum(t["pnl"] for t in side_trades)
            total_volume = sum(t["notional"] for t in side_trades)
            total_fees = sum(t["fee"] for t in side_trades)
            win_rate = len(winners) / len(side_trades) if side_trades else 0.0
            avg_win = sum(t["pnl"] for t in winners) / len(winners) if winners else 0.0
            avg_loss = sum(t["pnl"] for t in losers) / len(losers) if losers else 0.0
            
            return {
                "trades": len(side_trades),
                "winRate": win_rate,
                "avgWin": avg_win,
                "avgLoss": avg_loss,
                "totalPnl": total_pnl,
                "volume": total_volume,
                "fees": total_fees,
                "top3": top3
            }

        # Calculate overall stats
        all_winners = [t for t in trades if t["pnl"] > 0]
        all_losers = [t for t in trades if t["pnl"] < 0]
        
        # Find biggest orders, winner, loser
        biggest_orders = sorted(trades, key=lambda x: x["notional"], reverse=True)[:5]
        biggest_winner = max(trades, key=lambda x: x["pnl"])
        biggest_loser = min(trades, key=lambda x: x["pnl"])
        
        # Calculate most traded symbol
        symbol_counts = {}
        for t in trades:
            symbol = t["symbol"]
            symbol_counts[symbol] = symbol_counts.get(symbol, 0) + 1
        most_traded = max(symbol_counts.items(), key=lambda x: x[1])[0] if symbol_counts else "N/A"
        
        # Calculate overall metrics
        total_pnl = sum(t["pnl"] for t in trades)
        total_volume = sum(t["notional"] for t in trades)
        total_fees = sum(t["fee"] for t in trades)
        win_rate = len(all_winners) / len(trades) if trades else 0.0
        avg_win = sum(t["pnl"] for t in all_winners) / len(all_winners) if all_winners else 0.0
        avg_loss = sum(t["pnl"] for t in all_losers) / len(all_losers) if all_losers else 0.0
        avg_notional = total_volume / len(trades) if trades else 0.0

        print(f"DEBUG: Calculated basic stats - Total PnL: ${total_pnl:.2f}, Win rate: {win_rate:.3f}, Trades: {len(trades)}")

        # Calculate position tendency (recent 100 trades)
        recent_trades = trades[-100:] if len(trades) >= 100 else trades
        recent_longs = len([t for t in recent_trades if t["side"] == "long"])
        recent_shorts = len([t for t in recent_trades if t["side"] == "short"])
        
        position_tendency = "Neutral"
        if recent_longs > recent_shorts * 1.5:
            position_tendency = "Long Bias"
        elif recent_shorts > recent_longs * 1.5:
            position_tendency = "Short Bias"

        # Calculate time-based analysis
        def calculate_time_analysis():
            if len(trades) < 10:
                return {
                    "days": {day: {"trades": 0, "winRate": 0, "avgPnl": 0, "totalPnl": 0} for day in 
                            ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]},
                    "sessions": {
                        "Asia": {"trades": 0, "winRate": 0, "avgPnl": 0, "totalPnl": 0},
                        "Europe": {"trades": 0, "winRate": 0, "avgPnl": 0, "totalPnl": 0},
                        "US": {"trades": 0, "winRate": 0, "avgPnl": 0, "totalPnl": 0}
                    },
                    "hours": {}
                }
            
            from datetime import datetime, timezone
            
            # Initialize analysis structures
            daily_stats = {day: {"wins": 0, "total": 0, "pnl": 0} for day in 
                          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
            
            session_stats = {
                "Asia": {"wins": 0, "total": 0, "pnl": 0},      # 0-8 UTC
                "Europe": {"wins": 0, "total": 0, "pnl": 0},   # 8-16 UTC  
                "US": {"wins": 0, "total": 0, "pnl": 0}        # 16-24 UTC
            }
            
            hourly_stats = {hour: {"wins": 0, "total": 0, "pnl": 0} for hour in range(24)}
            
            # Process each trade
            for trade in trades:
                dt = datetime.fromtimestamp(trade["time"] / 1000, tz=timezone.utc)
                hour = dt.hour
                day_name = dt.strftime("%A")
                is_win = trade["pnl"] > 0
                
                # Day analysis
                daily_stats[day_name]["total"] += 1
                daily_stats[day_name]["pnl"] += trade["pnl"]
                if is_win:
                    daily_stats[day_name]["wins"] += 1
                
                # Session analysis
                if 0 <= hour < 8:
                    session = "Asia"
                elif 8 <= hour < 16:
                    session = "Europe"
                else:
                    session = "US"
                
                session_stats[session]["total"] += 1
                session_stats[session]["pnl"] += trade["pnl"]
                if is_win:
                    session_stats[session]["wins"] += 1
                
                # Hour analysis
                hourly_stats[hour]["total"] += 1
                hourly_stats[hour]["pnl"] += trade["pnl"]
                if is_win:
                    hourly_stats[hour]["wins"] += 1
            
            # Prepare time breakdown for frontend
            return {
                "days": {day: {
                    "trades": stats["total"],
                    "winRate": stats["wins"] / stats["total"] if stats["total"] > 0 else 0,
                    "avgPnl": stats["pnl"] / stats["total"] if stats["total"] > 0 else 0,
                    "totalPnl": stats["pnl"]
                } for day, stats in daily_stats.items()},
                
                "sessions": {session: {
                    "trades": stats["total"],
                    "winRate": stats["wins"] / stats["total"] if stats["total"] > 0 else 0,
                    "avgPnl": stats["pnl"] / stats["total"] if stats["total"] > 0 else 0,
                    "totalPnl": stats["pnl"]
                } for session, stats in session_stats.items()},
                
                "hours": {str(hour): {
                    "trades": stats["total"],
                    "winRate": stats["wins"] / stats["total"] if stats["total"] > 0 else 0,
                    "avgPnl": stats["pnl"] / stats["total"] if stats["total"] > 0 else 0,
                    "totalPnl": stats["pnl"]
                } for hour, stats in hourly_stats.items()}
            }
        
        try:
            time_breakdown = calculate_time_analysis()
        except Exception as e:
            print(f"ERROR: Failed to calculate time breakdown: {e}")
            time_breakdown = {
                "days": {},
                "sessions": {},
                "hours": {}
            }

        # Win streaks calculation removed for now

        # Import and use the new confidence calculator
        from confidence_calculator import ConfidenceCalculator
        
        try:
            calculator = ConfidenceCalculator()
            confidence_result = calculator.calculate_confidence_score(trades)
            confidence_score = confidence_result["score"]
            trader_rank = confidence_result["rank"]
            calculation_explanation = calculator.get_calculation_explanation()
            
            print(f"DEBUG: New confidence score: {confidence_score}, Rank: {trader_rank['name']}")
        except Exception as e:
            print(f"ERROR: Failed to calculate confidence score: {e}")
            confidence_score = 25
            trader_rank = {"rank": "Bronze", "color": "#cd7f32", "icon": "🥉"}
            calculation_explanation = {}

        return jsonify({
            "totalTrades": len(trades),
            "winRate": win_rate,
            "avgWin": avg_win,
            "avgLoss": avg_loss,
            "realizedPnl": total_pnl,
            "unrealizedPnl": total_unrealized_pnl,
            "totalPnl": total_pnl + total_unrealized_pnl,
            "volume": total_volume,
            "fees": total_fees,
            "avgNotional": avg_notional,
            "mostTraded": most_traded,
            "positionTendency": position_tendency,
            "recentLongs": recent_longs,
            "recentShorts": recent_shorts,
            "confidenceScore": confidence_score,
            "traderRank": trader_rank,
            "calculationExplanation": calculation_explanation,
            "openPositions": open_positions,
            "timeBreakdown": time_breakdown,
            "longs": calculate_side_stats(longs),
            "shorts": calculate_side_stats(shorts),
            "biggestOrders": [{"symbol": t["symbol"], "notional": t["notional"]} for t in biggest_orders],
            "biggestWinner": {"symbol": biggest_winner["symbol"], "pnl": biggest_winner["pnl"]},
            "biggestLoser": {"symbol": biggest_loser["symbol"], "pnl": biggest_loser["pnl"]},
            "pnlChart": pnl_chart[-2000:]  # Last 2000 trades
        })

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/')
def serve_react_app():
    return send_from_directory('my-app/out', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    try:
        return send_from_directory('my-app/out', path)
    except FileNotFoundError:
        return send_from_directory('my-app/out', 'index.html')

if __name__ == '__main__':
    print("Starting Flask app on 0.0.0.0:5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
