import { db } from "./db";
import { trades, portfolio, tradingBots, botTrades, paperAccounts, paperPositions } from "@shared/schema";
import { calculateRiskMetrics } from "./coinbase-service";
import { executeOrder } from "./coinbase-service";
import { SMA, RSI, BollingerBands } from "technicalindicators";
import { log } from "./vite";
import { sql } from "drizzle-orm";

interface PriceData {
  timestamp: number;
  price: number;
}

interface StrategyConfig {
  type: 'MA_CROSSOVER' | 'RSI_OVERSOLD' | 'BOLLINGER_BOUNCE';
  symbol: string;
  amount: number;
  interval: number; // in milliseconds
  params: {
    shortPeriod?: number;
    longPeriod?: number;
    rsiPeriod?: number;
    oversoldThreshold?: number;
    overboughtThreshold?: number;
    deviations?: number;
    period?: number;
  };
}

interface StrategyState {
  config: StrategyConfig;
  isActive: boolean;
  lastCheck: number;
  priceHistory: PriceData[];
}

class AlgorithmicTradingService {
  private strategies: Map<string, StrategyState> = new Map();

  async startStrategy(userId: number, config: StrategyConfig): Promise<void> {
    const strategyKey = `${userId}-${config.symbol}`;

    // Initialize strategy state
    this.strategies.set(strategyKey, {
      config,
      isActive: true,
      lastCheck: Date.now(),
      priceHistory: []
    });

    // Start the trading loop
    this.runStrategy(userId, strategyKey);
  }

  async stopStrategy(userId: number, symbol: string): Promise<void> {
    const strategyKey = `${userId}-${symbol}`;
    const strategy = this.strategies.get(strategyKey);
    if (strategy) {
      strategy.isActive = false;
      this.strategies.delete(strategyKey);
    }
  }

  private async runStrategy(userId: number, strategyKey: string): Promise<void> {
    const strategy = this.strategies.get(strategyKey);
    if (!strategy || !strategy.isActive) return;

    try {
      // Get current price from risk metrics
      const metrics = await calculateRiskMetrics(strategy.config.symbol);
      const currentPrice = Number(metrics.currentPrice);

      if (!currentPrice) {
        throw new Error("Failed to get current price");
      }

      strategy.priceHistory.push({
        timestamp: Date.now(),
        price: currentPrice
      });

      // Keep last 100 price points
      if (strategy.priceHistory.length > 100) {
        strategy.priceHistory.shift();
      }

      // Execute strategy based on type
      const signal = await this.evaluateStrategy(strategy);
      if (signal) {
        await this.executeSignal(userId, strategy.config, signal, currentPrice);
      }

      // Schedule next check
      setTimeout(() => {
        this.runStrategy(userId, strategyKey);
      }, strategy.config.interval);

    } catch (error) {
      log(`Error running strategy ${strategyKey}: ${error}`);
      strategy.isActive = false;
    }
  }

  private async evaluateStrategy(strategy: StrategyState): Promise<'buy' | 'sell' | null> {
    const prices = strategy.priceHistory.map(p => p.price);

    switch (strategy.config.type) {
      case 'MA_CROSSOVER': {
        const { shortPeriod = 10, longPeriod = 20 } = strategy.config.params;
        if (prices.length < longPeriod) return null;

        const shortMA = SMA.calculate({ period: shortPeriod, values: prices });
        const longMA = SMA.calculate({ period: longPeriod, values: prices });

        const currentShortMA = shortMA[shortMA.length - 1];
        const previousShortMA = shortMA[shortMA.length - 2];
        const currentLongMA = longMA[longMA.length - 1];
        const previousLongMA = longMA[longMA.length - 2];

        // Detect crossover
        if (previousShortMA < previousLongMA && currentShortMA > currentLongMA) {
          return 'buy';
        }
        if (previousShortMA > previousLongMA && currentShortMA < currentLongMA) {
          return 'sell';
        }
        break;
      }

      case 'RSI_OVERSOLD': {
        const { rsiPeriod = 14, oversoldThreshold = 30, overboughtThreshold = 70 } = strategy.config.params;
        if (prices.length < rsiPeriod) return null;

        const rsiValues = RSI.calculate({ period: rsiPeriod, values: prices });
        const currentRSI = rsiValues[rsiValues.length - 1];

        if (currentRSI < oversoldThreshold) {
          return 'buy';
        }
        if (currentRSI > overboughtThreshold) {
          return 'sell';
        }
        break;
      }

      case 'BOLLINGER_BOUNCE': {
        const { period = 20, deviations = 2 } = strategy.config.params;
        if (prices.length < period) return null;

        const bb = BollingerBands.calculate({
          period,
          stdDev: deviations,
          values: prices
        });

        const current = bb[bb.length - 1];
        const currentPrice = prices[prices.length - 1];

        if (currentPrice < current.lower) {
          return 'buy';
        }
        if (currentPrice > current.upper) {
          return 'sell';
        }
        break;
      }
    }

    return null;
  }

  private async executeSignal(
    userId: number,
    config: StrategyConfig,
    signal: 'buy' | 'sell',
    currentPrice: number
  ): Promise<void> {
    try {
      // Get bot configuration to determine mode (paper/live)
      const [bot] = await db
        .select()
        .from(tradingBots)
        .where(sql`user_id = ${userId} AND symbol = ${config.symbol} AND status = 'active'`);

      if (!bot) {
        throw new Error("No active bot found");
      }

      if (bot.mode === 'live') {
        // Execute real trade
        await executeOrder(signal, config.symbol, config.amount);

        // Record the trade
        const tradeValues = {
          userId,
          symbol: config.symbol,
          amount: config.amount.toString(),
          price: currentPrice.toString(),
          type: signal,
        };

        await db.insert(trades).values(tradeValues);

        // Update portfolio
        const multiplier = signal === 'buy' ? 1 : -1;
        await db.transaction(async (tx) => {
          const [position] = await tx
            .select()
            .from(portfolio)
            .where(sql`user_id = ${userId} AND symbol = ${config.symbol}`);

          if (position) {
            const newAmount = Number(position.amount) + (multiplier * config.amount);
            if (newAmount === 0) {
              await tx
                .delete(portfolio)
                .where(sql`user_id = ${userId} AND symbol = ${config.symbol}`);
            } else {
              await tx
                .update(portfolio)
                .set({ amount: newAmount.toString() })
                .where(sql`user_id = ${userId} AND symbol = ${config.symbol}`);
            }
          } else if (signal === 'buy') {
            await tx.insert(portfolio).values({
              userId,
              symbol: config.symbol,
              amount: config.amount.toString(),
            });
          }
        });
      } else {
        // Paper trading mode
        const [paperAccount] = await db
          .select()
          .from(paperAccounts)
          .where(sql`user_id = ${userId}`);

        if (!paperAccount) {
          throw new Error("Paper trading account not found");
        }

        // Record paper trade
        await db.insert(botTrades).values({
          botId: bot.id,
          symbol: config.symbol,
          type: signal,
          amount: config.amount,
          price: currentPrice,
          mode: 'paper'
        });

        // Update paper positions
        await db.transaction(async (tx) => {
          const [position] = await tx
            .select()
            .from(paperPositions)
            .where(sql`account_id = ${paperAccount.id} AND symbol = ${config.symbol}`);

          const tradeValue = config.amount * currentPrice;

          if (signal === 'buy') {
            // Check if enough balance
            if (Number(paperAccount.balance) < tradeValue) {
              throw new Error("Insufficient paper trading balance");
            }

            // Update balance
            await tx
              .update(paperAccounts)
              .set({ 
                balance: (Number(paperAccount.balance) - tradeValue).toString(),
                updatedAt: new Date()
              })
              .where(sql`id = ${paperAccount.id}`);

            // Update position
            if (position) {
              const newAmount = Number(position.amount) + config.amount;
              const newAvgPrice = ((Number(position.amount) * Number(position.averagePrice)) + tradeValue) / newAmount;

              await tx
                .update(paperPositions)
                .set({ 
                  amount: newAmount.toString(),
                  averagePrice: newAvgPrice.toString(),
                  updatedAt: new Date()
                })
                .where(sql`id = ${position.id}`);
            } else {
              await tx.insert(paperPositions).values({
                accountId: paperAccount.id,
                symbol: config.symbol,
                amount: config.amount.toString(),
                averagePrice: currentPrice.toString()
              });
            }
          } else {
            // Selling
            if (!position || Number(position.amount) < config.amount) {
              throw new Error("Insufficient position for paper trading sell");
            }

            const newAmount = Number(position.amount) - config.amount;
            const pnl = (currentPrice - Number(position.averagePrice)) * config.amount;

            // Update balance
            await tx
              .update(paperAccounts)
              .set({ 
                balance: (Number(paperAccount.balance) + tradeValue).toString(),
                updatedAt: new Date()
              })
              .where(sql`id = ${paperAccount.id}`);

            // Update position
            if (newAmount === 0) {
              await tx
                .delete(paperPositions)
                .where(sql`id = ${position.id}`);
            } else {
              await tx
                .update(paperPositions)
                .set({ 
                  amount: newAmount.toString(),
                  updatedAt: new Date()
                })
                .where(sql`id = ${position.id}`);
            }

            // Update trade with PNL
            await tx
              .update(botTrades)
              .set({ pnl: pnl.toString() })
              .where(sql`id = currval('bot_trades_id_seq')`);
          }
        });
      }

      log(`Successfully executed ${signal} signal for strategy ${userId}-${config.symbol}`);
    } catch (error) {
      log(`Error executing ${signal} signal: ${error}`);
      throw error;
    }
  }
}

export const algorithmicTradingService = new AlgorithmicTradingService();