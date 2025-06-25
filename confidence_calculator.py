
class ConfidenceCalculator:
    def __init__(self):
        # Rank definitions with futuristic SVG logos
        self.ranks = {
            "challenger": {
                "min_score": 100,
                "name": "Challenger",
                "displayName": "Challenger",
                "logo": """<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="challengerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#ff4d00;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#ffaa00;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#ff0066;stop-opacity:1" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#challengerGrad)" stroke="#fff" stroke-width="2" filter="url(#glow)"/>
                    <polygon points="50,15 65,35 85,35 70,50 75,70 50,60 25,70 30,50 15,35 35,35" fill="#fff" opacity="0.9"/>
                    <text x="50" y="58" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle" fill="#333">HL</text>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-width="1" opacity="0.3"/>
                </svg>""",
                "color": "#ff6b35",
                "gradient": "from-orange-500 to-red-500",
                "description": "Legendary Trader - Beyond Diamond"
            },
            "diamond": {
                "min_score": 80,
                "name": "Diamond",
                "displayName": "Diamond", 
                "logo": """<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#0099cc;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#004d99;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#diamondGrad)" stroke="#00d4ff" stroke-width="2"/>
                    <polygon points="50,20 70,35 70,65 50,80 30,65 30,35" fill="#fff" opacity="0.9"/>
                    <polygon points="50,25 65,37 65,63 50,75 35,63 35,37" fill="none" stroke="#00d4ff" stroke-width="2"/>
                    <text x="50" y="58" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#004d99">HL</text>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#00d4ff" stroke-width="1" opacity="0.5"/>
                </svg>""",
                "color": "#b9f2ff",
                "gradient": "from-cyan-400 to-blue-500",
                "description": "Elite Trader - Exceptional Performance"
            },
            "platinum": {
                "min_score": 65,
                "name": "Platinum",
                "displayName": "Platinum",
                "logo": """<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="platinumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#e0e0e0;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#c0c0c0;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#a0a0a0;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#platinumGrad)" stroke="#e0e0e0" stroke-width="2"/>
                    <rect x="25" y="25" width="50" height="50" rx="8" fill="#fff" opacity="0.9"/>
                    <rect x="30" y="30" width="40" height="40" rx="6" fill="none" stroke="#a0a0a0" stroke-width="2"/>
                    <text x="50" y="58" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#666">HL</text>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#c0c0c0" stroke-width="1" opacity="0.5"/>
                </svg>""",
                "color": "#e5e7eb",
                "gradient": "from-gray-300 to-gray-500",
                "description": "Expert Trader - Excellent Consistency"
            },
            "gold": {
                "min_score": 50,
                "name": "Gold",
                "displayName": "Gold",
                "logo": """<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#ffb000;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#cc8800;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#goldGrad)" stroke="#ffd700" stroke-width="2"/>
                    <polygon points="50,22 62,38 80,38 67,52 72,70 50,62 28,70 33,52 20,38 38,38" fill="#fff" opacity="0.9"/>
                    <text x="50" y="58" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle" fill="#cc8800">HL</text>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#ffd700" stroke-width="1" opacity="0.5"/>
                </svg>""",
                "color": "#fbbf24",
                "gradient": "from-yellow-400 to-yellow-600",
                "description": "Skilled Trader - Above Average"
            },
            "silver": {
                "min_score": 25,
                "name": "Silver",
                "displayName": "Silver", 
                "logo": """<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#c0c0c0;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#a0a0a0;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#808080;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#silverGrad)" stroke="#c0c0c0" stroke-width="2"/>
                    <polygon points="50,25 60,40 75,40 65,52 68,67 50,60 32,67 35,52 25,40 40,40" fill="#fff" opacity="0.8"/>
                    <text x="50" y="58" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle" fill="#666">HL</text>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#a0a0a0" stroke-width="1" opacity="0.4"/>
                </svg>""",
                "color": "#9ca3af",
                "gradient": "from-gray-400 to-gray-600",
                "description": "Developing Trader - Room for Growth"
            },
            "bronze": {
                "min_score": 0,
                "name": "Bronze",
                "displayName": "Bronze",
                "logo": """<svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bronzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#cd7f32;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#b8860b;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#8b4513;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="url(#bronzeGrad)" stroke="#cd7f32" stroke-width="2"/>
                    <polygon points="50,28 58,42 72,42 62,52 65,66 50,59 35,66 38,52 28,42 42,42" fill="#fff" opacity="0.7"/>
                    <text x="50" y="58" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle" fill="#5d2d10">HL</text>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#b8860b" stroke-width="1" opacity="0.3"/>
                </svg>""",
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
                return {"score": max(1, len(trades_data) * 2), "rank": self.get_rank(max(1, len(trades_data) * 2))}
            
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
            
            print(f"DEBUG Confidence: {len(trades)} trades, Win Rate: {win_rate:.3f}, PnL: ${total_pnl:.2f}")
            
            # Start with neutral base
            score = 50
            
            # 1. WIN RATE SCORING (40% weight) - Most important
            if win_rate >= 0.75:        # 75%+ exceptional
                score += 30
            elif win_rate >= 0.65:      # 65%+ excellent
                score += 20
            elif win_rate >= 0.55:      # 55%+ very good
                score += 10
            elif win_rate >= 0.50:      # 50%+ good
                score += 5
            elif win_rate >= 0.45:      # 45%+ average
                score -= 5
            elif win_rate >= 0.40:      # 40%+ below average
                score -= 10
            elif win_rate >= 0.30:      # 30%+ poor
                score -= 20
            else:                       # <30% very poor
                score -= 30
            
            # 2. PNL SCORING (35% weight) - Second most important
            if total_pnl >= 100000:     # $100k+ is diamond tier
                score += 25
            elif total_pnl >= 50000:    # $50k+ excellent
                score += 18
            elif total_pnl >= 25000:    # $25k+ very good
                score += 12
            elif total_pnl >= 10000:    # $10k+ good
                score += 8
            elif total_pnl >= 5000:     # $5k+ okay
                score += 4
            elif total_pnl >= 1000:     # $1k+ neutral
                score += 0
            elif total_pnl >= 0:        # Break even
                score -= 4
            elif total_pnl >= -5000:    # Small loss
                score -= 8
            elif total_pnl >= -10000:   # Medium loss
                score -= 16
            else:                       # Large loss
                score -= 24
            
            # 3. RISK/REWARD RATIO (15% weight)
            if avg_win > 0 and avg_loss < 0:
                risk_reward = abs(avg_win / avg_loss)
                if risk_reward >= 3.0:      # Excellent 3:1
                    score += 12
                elif risk_reward >= 2.0:    # Very good 2:1
                    score += 8
                elif risk_reward >= 1.5:    # Good 1.5:1
                    score += 4
                elif risk_reward >= 1.0:    # Break even 1:1
                    score += 0
                elif risk_reward >= 0.8:    # Below par
                    score -= 4
                else:                       # Poor risk management
                    score -= 8
            
            # 4. SAMPLE SIZE BONUS (10% weight) - Confidence in data
            if len(trades) >= 1000:     # Very high confidence
                score += 8
            elif len(trades) >= 500:    # High confidence
                score += 6
            elif len(trades) >= 200:    # Good confidence
                score += 4
            elif len(trades) >= 100:    # Moderate confidence
                score += 2
            elif len(trades) >= 50:     # Low confidence
                score += 0
            else:                       # Very low confidence
                score -= 2
            
            # 5. BONUS POINTS for exceptional performance
            bonus = 0
            
            # Consistency bonus (if win rate > 60% AND positive PnL)
            if win_rate > 0.6 and total_pnl > 0:
                bonus += 5
                
            # High volume trader bonus
            if total_volume > 1000000:  # $1M+ volume
                bonus += 5
                
            # Big winner bonus
            if total_pnl > 50000:       # $50k+ PnL
                bonus += 10
                
            # Ultra performance bonus (can push over 100 to Challenger)
            if win_rate > 0.7 and total_pnl > 100000:
                bonus += 15
                
            final_score = max(0, score + bonus)
            
            print(f"DEBUG: Final score: {final_score} (base: {score}, bonus: {bonus})")
            
            return {
                "score": final_score,
                "rank": self.get_rank(final_score),
                "breakdown": {
                    "winRate": win_rate,
                    "totalPnl": total_pnl,
                    "riskReward": abs(avg_win / avg_loss) if avg_win > 0 and avg_loss < 0 else 0,
                    "sampleSize": len(trades),
                    "bonus": bonus
                }
            }
            
        except Exception as e:
            print(f"ERROR in confidence calculation: {e}")
            return {"score": 25, "rank": self.get_rank(25)}
    
    def get_rank(self, score):
        """Get rank info based on score"""
        for rank_key in ["challenger", "diamond", "platinum", "gold", "silver", "bronze"]:
            if score >= self.ranks[rank_key]["min_score"]:
                rank_info = self.ranks[rank_key].copy()
                
                # Add sub-tier (1-4 within each rank)
                if rank_key != "challenger":
                    rank_range = 25 if rank_key == "bronze" else 15  # Bronze is 0-25, others are 15-point ranges
                    min_score = self.ranks[rank_key]["min_score"]
                    progress_in_rank = score - min_score
                    sub_tier = min(4, max(1, int(progress_in_rank / (rank_range / 4)) + 1))
                    rank_info["subTier"] = sub_tier
                    rank_info["displayName"] = f'{rank_info["name"]} {sub_tier}'
                else:
                    rank_info["displayName"] = rank_info["name"]
                
                return rank_info
        
        # Fallback
        return self.ranks["bronze"]
    
    def get_calculation_explanation(self):
        """Return explanation of how confidence score is calculated"""
        return {
            "title": "Confidence Score Calculation",
            "description": "Based on your recent trading performance across multiple factors:",
            "factors": [
                {"name": "Win Rate", "weight": "40%", "description": "Percentage of profitable trades"},
                {"name": "Total PnL", "weight": "35%", "description": "Net profit/loss from all trades"},
                {"name": "Risk/Reward", "weight": "15%", "description": "Average win vs average loss ratio"},
                {"name": "Sample Size", "weight": "10%", "description": "Number of trades for statistical confidence"},
                {"name": "Bonus Points", "weight": "Variable", "description": "Consistency, volume, and exceptional performance"}
            ],
            "ranks": [
                {"name": "Challenger", "range": "100+", "description": "Legendary performance - beyond Diamond"},
                {"name": "Diamond", "range": "80-99", "description": "Elite trader - exceptional consistency"},
                {"name": "Platinum", "range": "65-79", "description": "Expert trader - excellent performance"},
                {"name": "Gold", "range": "50-64", "description": "Skilled trader - above average"},
                {"name": "Silver", "range": "25-49", "description": "Developing trader - room for growth"},
                {"name": "Bronze", "range": "0-24", "description": "Learning trader - focus on improvement"}
            ]
        }
