import { pgTable, text, serial, integer, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("10000"),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  amount: decimal("amount", { precision: 10, scale: 8 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  type: text("type", { enum: ["buy", "sell"] }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  amount: decimal("amount", { precision: 10, scale: 8 }).notNull(),
});

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  type: text("type", { enum: ["above", "below"] }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  triggeredAt: timestamp("triggered_at"),
});

export const collateralLoans = pgTable("collateral_loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  collateralSymbol: text("collateral_symbol").notNull(),
  collateralAmount: decimal("collateral_amount", { precision: 10, scale: 8 }).notNull(),
  borrowedSymbol: text("borrowed_symbol").notNull(),
  borrowedAmount: decimal("borrowed_amount", { precision: 10, scale: 8 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status", { enum: ["active", "repaid", "liquidated"] }).notNull().default("active"),
  liquidationPrice: decimal("liquidation_price", { precision: 10, scale: 2 }).notNull(),
  lastInterestPayment: timestamp("last_interest_payment").notNull().defaultNow(),
});

export const tradingBots = pgTable("trading_bots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  strategy: text("strategy", { enum: ["mean_reversion", "trend_following", "grid_trading"] }).notNull(),
  symbol: text("symbol").notNull(),
  status: text("status", { enum: ["active", "paused", "stopped"] }).notNull().default("stopped"),
  mode: text("mode", { enum: ["paper", "live"] }).notNull().default("paper"),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const botTrades = pgTable("bot_trades", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().references(() => tradingBots.id),
  symbol: text("symbol").notNull(),
  type: text("type", { enum: ["buy", "sell"] }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 8 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  mode: text("mode", { enum: ["paper", "live"] }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
});

export const paperAccounts = pgTable("paper_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("10000"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paperPositions = pgTable("paper_positions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => paperAccounts.id),
  symbol: text("symbol").notNull(),
  amount: decimal("amount", { precision: 10, scale: 8 }).notNull(),
  averagePrice: decimal("average_price", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTradeSchema = createInsertSchema(trades).pick({
  symbol: true,
  amount: true,
  price: true,
  type: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).pick({
  symbol: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts)
  .pick({
    symbol: true,
    targetPrice: true,
    type: true,
  })
  .extend({
    targetPrice: z.number().positive("Target price must be positive"),
  });

export const insertCollateralLoanSchema = createInsertSchema(collateralLoans)
  .pick({
    collateralSymbol: true,
    collateralAmount: true,
    borrowedSymbol: true,
    borrowedAmount: true,
    dueDate: true,
  })
  .extend({
    collateralAmount: z.number().positive("Collateral amount must be positive"),
    borrowedAmount: z.number().positive("Borrowed amount must be positive"),
    dueDate: z.date().min(new Date(), "Due date must be in the future"),
  });

export const insertTradingBotSchema = createInsertSchema(tradingBots)
  .pick({
    name: true,
    strategy: true,
    symbol: true,
    mode: true,
    config: true,
  })
  .extend({
    config: z.object({
      riskPerTrade: z.number().min(0.1).max(100),
      stopLoss: z.number().optional(),
      takeProfit: z.number().optional(),
      timeframe: z.string(),
      parameters: z.record(z.any()),
    }),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type InsertCollateralLoan = z.infer<typeof insertCollateralLoanSchema>;
export type User = typeof users.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Portfolio = typeof portfolio.$inferSelect;
export type Watchlist = typeof watchlist.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type CollateralLoan = typeof collateralLoans.$inferSelect;
export type InsertTradingBot = z.infer<typeof insertTradingBotSchema>;
export type TradingBot = typeof tradingBots.$inferSelect;
export type BotTrade = typeof botTrades.$inferSelect;
export type PaperAccount = typeof paperAccounts.$inferSelect;
export type PaperPosition = typeof paperPositions.$inferSelect;