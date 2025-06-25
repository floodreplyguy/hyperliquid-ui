
class ConfidenceCalculator:
    def __init__(self):
        # Rank definitions with futuristic SVG logos
        self.ranks = {
            "challenger": {
                "min_score": 100,
                "name": "Challenger",
                "displayName": "Challenger",
                "logo": "⚡",
                "color": "#ff6b35",
                "gradient": "from-orange-500 to-red-500",
                "description": "Legendary Trader - Beyond Diamond"
            },
            "diamond": {
                "min_score": 80,
                "name": "Diamond",
                "displayName": "Diamond", 
                "logo": "💎",
                "color": "#b9f2ff",
                "gradient": "from-cyan-400 to-blue-500",
                "description": "Elite Trader - Exceptional Performance"
            },
            "platinum": {
                "min_score": 60,
                "name": "Platinum",
                "displayName": "Platinum",
                "logo": "🏆",
                "color": "#e5e7eb",
                "gradient": "from-gray-300 to-gray-500",
                "description": "Expert Trader - Excellent Consistency"
            },
            "gold": {
                "min_score": 40,
                "name": "Gold",
                "displayName": "Gold",
                "logo": "🥇",
                "color": "#fbbf24",
                "gradient": "from-yellow-400 to-yellow-600",
                "description": "Skilled Trader - Above Average"
            },
            "silver": {
                "min_score": 20,
                "name": "Silver",
                "displayName": "Silver", 
                "logo": "🥈",
                "color": "#9ca3af",
                "gradient": "from-gray-400 to-gray-600",
                "description": "Developing Trader - Room for Growth"
            },
            "bronze": {
                "min_score": 0,
                "name": "Bronze",
                "displayName": "Bronze",
                "logo": "🥉",
                "color": "#cd7f32", 
                "gradient": "from-orange-600 to-red-700",
                "description": "Learning Trader - Focus on Improvement"
            }
        }

    def calculate_confidence_score(self, trades_data):
        """
        Calculate confidence score based on recent trading performance
        Focus on: Win Rate, PnL, Risk/Reward, Volume consistency
        """
        try:
            if len(trades_data) < 5:
                base_score = max(10, len(trades_data) * 5)  # Give them a bit more starting score
                print(f"DEBUG: Low trade count {len(trades_data)}, giving base score: {base_score}")
                return {"score": base_score, "rank": self.get_rank(base_score)}

            # Use all available trades (up to 2000)
            trades = trades_data[-2000:] if len(trades_data) > 2000 else trades_data

            # Calculate base metrics
            total_pnl = sum(t.get("pnl", 0) for t in trades)
            total_volume = sum(abs(t.get("size", 0) * t.get("price", 0)) for t in trades)
            winners = [t for t in trades if t.get("pnl", 0) > 0]
            losers = [t for t in trades if t.get("pnl", 0) < 0]

            win_rate = len(winners) / len(trades) if trades else 0
            avg_win = sum(t["pnl"] for t in winners) / len(winners) if winners else 0
            avg_loss = sum(t["pnl"] for t in losers) / len(losers) if losers else 0

            print(f"DEBUG Confidence: {len(trades)} trades, Win Rate: {win_rate:.3f}, PnL: ${total_pnl:.2f}, Volume: ${total_volume:.2f}")
            print(f"DEBUG Winners: {len(winners)}, Losers: {len(losers)}, Avg Win: ${avg_win:.2f}, Avg Loss: ${avg_loss:.2f}")

            # Start from zero and build score based on performance
            score = 0

            # 1. WIN RATE SCORING (40% weight)
            win_rate_points = 0
            if win_rate >= 0.50:      # 50%+ awesome
                win_rate_points = 40
            elif win_rate >= 0.40:    # 40%+ good
                win_rate_points = 30
            elif win_rate >= 0.30:    # 30% average
                win_rate_points = 20
            elif win_rate >= 0.20:    # 20% bronze tier
                win_rate_points = 10
            else:                     # below 20%
                win_rate_points = 0
            
            score += win_rate_points
            print(f"DEBUG: Win rate {win_rate:.3f} -> {win_rate_points} points")

            # 2. PNL SCORING (40% weight)
            pnl_points = 0
            if total_pnl >= 200000:     # Hundreds of thousands - diamond tier
                pnl_points = 40
            elif total_pnl >= 100000:   # Six figures
                pnl_points = 35
            elif total_pnl >= 50000:    # Very strong
                pnl_points = 30
            elif total_pnl >= 10000:    # Solid profits
                pnl_points = 25
            elif total_pnl >= 5000:     # Average
                pnl_points = 20
            elif total_pnl >= 1000:     # A couple thousand
                pnl_points = 15
            elif total_pnl >= 0:        # Break even
                pnl_points = 10
            elif total_pnl >= -5000:    # Small loss
                pnl_points = 5
            else:                       # Large loss
                pnl_points = 0
            
            score += pnl_points
            print(f"DEBUG: PnL ${total_pnl:.2f} -> {pnl_points} points")

            # 3. RISK/REWARD RATIO (15% weight)
            rr_points = 0
            if avg_win > 0 and avg_loss < 0:
                risk_reward = abs(avg_win / avg_loss)
                if risk_reward >= 2.0:
                    rr_points = 15
                elif risk_reward >= 1.5:
                    rr_points = 12
                elif risk_reward >= 1.2:
                    rr_points = 8
                elif risk_reward >= 1.0:
                    rr_points = 5
                elif risk_reward >= 0.8:
                    rr_points = 2
                else:
                    rr_points = 0
                print(f"DEBUG: Risk/Reward {risk_reward:.2f} -> {rr_points} points")
            else:
                print(f"DEBUG: Cannot calculate R/R (avg_win: {avg_win}, avg_loss: {avg_loss})")

            score += rr_points

            # 4. TIME CONSISTENCY (5% weight)
            time_points = 0
            duration_days = 0
            try:
                times = [t.get("time") for t in trades if t.get("time") is not None]
                if times:
                    start = min(times)
                    end = max(times)
                    duration_days = (end - start) / (1000 * 60 * 60 * 24)
                    if duration_days >= 365:
                        time_points = 5
                    elif duration_days >= 180:
                        time_points = 3
                    elif duration_days >= 90:
                        time_points = 1
                print(f"DEBUG: Trading duration {duration_days:.1f} days -> {time_points} points")
            except Exception as e:
                print(f"DEBUG: Failed to compute trading duration: {e}")

            score += time_points

            # 5. BONUS POINTS for exceptional performance
            bonus = 0

            # Consistency bonus (if win rate > 60% AND positive PnL)
            if win_rate > 0.6 and total_pnl > 0:
                bonus += 5
                print(f"DEBUG: Consistency bonus +5")

            # High volume trader bonus
            if total_volume > 1000000:  # $1M+ volume
                bonus += 5
                print(f"DEBUG: High volume bonus +5")

            # Big winner bonus
            if total_pnl > 50000:       # $50k+ PnL
                bonus += 10
                print(f"DEBUG: Big winner bonus +10")

            # Ultra performance bonus (can push over 100 to Challenger)
            if win_rate > 0.7 and total_pnl > 100000:
                bonus += 15
                print(f"DEBUG: Ultra performance bonus +15")

            final_score = max(0, score + bonus)

            print(f"DEBUG: Final calculation - WR: {win_rate_points}, PnL: {pnl_points}, RR: {rr_points}, Time: {time_points}, Bonus: {bonus}")
            print(f"DEBUG: Final score: {final_score} (base score: {score}, bonus: {bonus})")

            rank_info = self.get_rank(final_score)
            print(f"DEBUG: Rank determined: {rank_info}")

            return {
                "score": final_score,
                "rank": rank_info,
                "breakdown": {
                    "winRate": win_rate,
                    "totalPnl": total_pnl,
                    "riskReward": abs(avg_win / avg_loss) if avg_win > 0 and avg_loss < 0 else 0,
                    "tradingDays": duration_days if 'duration_days' in locals() else 0,
                    "bonus": bonus
                }
            }

        except Exception as e:
            print(f"ERROR in confidence calculation: {e}")
            import traceback
            traceback.print_exc()
            return {"score": 25, "rank": self.get_rank(25)}

    def get_rank(self, score):
        """Get rank info based on score"""
        print(f"DEBUG get_rank: Calculating rank for score {score}")
        
        # Determine base rank - Fixed thresholds
        if score >= 100:
            rank_key = "challenger"
        elif score >= 80:
            rank_key = "diamond"
        elif score >= 60:
            rank_key = "platinum"
        elif score >= 40:
            rank_key = "gold"
        elif score >= 20:
            rank_key = "silver"
        else:
            rank_key = "bronze"
        
        print(f"DEBUG get_rank: Selected rank_key: {rank_key}")
        
        rank_info = self.ranks[rank_key].copy()

        # Add sub-tier (1-4 within each rank) except for Challenger
        if rank_key != "challenger":
            # Calculate sub-tier based on position within rank
            if rank_key == "bronze":
                # Bronze: 0-19 (20 points)
                rank_range = 20
                min_score = 0
            elif rank_key == "silver":
                # Silver: 20-39 (20 points)
                rank_range = 20
                min_score = 20
            elif rank_key == "gold":
                # Gold: 40-59 (20 points)
                rank_range = 20
                min_score = 40
            elif rank_key == "platinum":
                # Platinum: 60-79 (20 points)
                rank_range = 20
                min_score = 60
            elif rank_key == "diamond":
                # Diamond: 80-99 (20 points)
                rank_range = 20
                min_score = 80
            
            progress_in_rank = score - min_score
            # Sub-tier 1 is highest, 4 is lowest
            sub_tier = 4 - int(progress_in_rank / (rank_range / 4))
            sub_tier = max(1, min(4, sub_tier))
            rank_info["subTier"] = sub_tier
            rank_info["displayName"] = f'{rank_info["name"]} {sub_tier}'
            
            print(f"DEBUG get_rank: Sub-tier calculation - min_score: {min_score}, progress: {progress_in_rank}, sub_tier: {sub_tier}")
        else:
            rank_info["displayName"] = rank_info["name"]
            print(f"DEBUG get_rank: Challenger rank, no sub-tier")

        print(f"DEBUG get_rank: Final rank_info: {rank_info}")
        return rank_info

    def get_calculation_explanation(self):
        """Return explanation of how confidence score is calculated"""
        return {
            "title": "Confidence Score Calculation",
            "description": "Based on your recent trading performance across multiple factors:",
            "factors": [
                {"name": "Win Rate", "weight": "40%", "description": "Percentage of profitable trades"},
                {"name": "Total PnL", "weight": "40%", "description": "Net profit/loss from all trades"},
                {"name": "Risk/Reward", "weight": "15%", "description": "Average win vs average loss ratio"},
                {"name": "Time Consistency", "weight": "5%", "description": "How long the account has been actively trading"},
                {"name": "Bonus Points", "weight": "Variable", "description": "Consistency, volume, and exceptional performance"}
            ],
            "ranks": [
                {"name": "Challenger", "range": "100+", "description": "Legendary performance - beyond Diamond"},
                {"name": "Diamond", "range": "80-99", "description": "Elite trader - exceptional consistency"},
                {"name": "Platinum", "range": "60-79", "description": "Expert trader - excellent performance"},
                {"name": "Gold", "range": "40-59", "description": "Skilled trader - above average"},
                {"name": "Silver", "range": "20-39", "description": "Developing trader - room for growth"},
                {"name": "Bronze", "range": "0-19", "description": "Learning trader - focus on improvement"}
            ]
        }
