import { InsertUser, User, Trade, Portfolio, Watchlist, InsertTrade, InsertWatchlist, InsertPriceAlert, PriceAlert, CollateralLoan, InsertCollateralLoan } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, and, lt, gte } from "drizzle-orm";
import { users, trades, portfolio, watchlist, priceAlerts, collateralLoans } from "@shared/schema";
import { pool } from "./db";
import { sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Trading
  getTrades(userId: number): Promise<Trade[]>;
  createTrade(userId: number, trade: InsertTrade): Promise<Trade>;

  // Portfolio
  getPortfolio(userId: number): Promise<Portfolio[]>;
  updatePortfolio(userId: number, symbol: string, amount: number): Promise<void>;

  // Watchlist
  getWatchlist(userId: number): Promise<Watchlist[]>;
  addToWatchlist(userId: number, symbol: string): Promise<Watchlist>;
  removeFromWatchlist(userId: number, symbol: string): Promise<void>;

  // Price Alerts
  getPriceAlerts(userId: number): Promise<PriceAlert[]>;
  getPriceAlert(id: number): Promise<PriceAlert | undefined>;
  createPriceAlert(userId: number, alert: InsertPriceAlert): Promise<PriceAlert>;
  deactivatePriceAlert(id: number): Promise<void>;

  // Lending
  getCollateralLoans(userId: number): Promise<CollateralLoan[]>;
  getActiveCollateralLoans(): Promise<CollateralLoan[]>;
  createCollateralLoan(userId: number, loan: InsertCollateralLoan): Promise<CollateralLoan>;
  repayCollateralLoan(loanId: number): Promise<void>;
  liquidateCollateralLoan(loanId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getTrades(userId: number): Promise<Trade[]> {
    return db.select().from(trades).where(eq(trades.userId, userId));
  }

  async createTrade(userId: number, trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db
      .insert(trades)
      .values({ ...trade, userId })
      .returning();
    return newTrade;
  }

  async getPortfolio(userId: number): Promise<Portfolio[]> {
    return db.select().from(portfolio).where(eq(portfolio.userId, userId));
  }

  async updatePortfolio(userId: number, symbol: string, amount: number): Promise<void> {
    const [existing] = await db
      .select()
      .from(portfolio)
      .where(and(eq(portfolio.userId, userId), eq(portfolio.symbol, symbol)));

    if (existing) {
      const newAmount = Number(existing.amount) + amount;
      if (newAmount === 0) {
        await db
          .delete(portfolio)
          .where(and(eq(portfolio.userId, userId), eq(portfolio.symbol, symbol)));
      } else {
        await db
          .update(portfolio)
          .set({ amount: newAmount.toString() })
          .where(and(eq(portfolio.userId, userId), eq(portfolio.symbol, symbol)));
      }
    } else if (amount !== 0) {
      await db
        .insert(portfolio)
        .values({ userId, symbol, amount: amount.toString() });
    }
  }

  async getWatchlist(userId: number): Promise<Watchlist[]> {
    return db.select().from(watchlist).where(eq(watchlist.userId, userId));
  }

  async addToWatchlist(userId: number, symbol: string): Promise<Watchlist> {
    const [item] = await db
      .insert(watchlist)
      .values({ userId, symbol })
      .returning();
    return item;
  }

  async removeFromWatchlist(userId: number, symbol: string): Promise<void> {
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol)));
  }

  async getPriceAlerts(userId: number): Promise<PriceAlert[]> {
    return db
      .select()
      .from(priceAlerts)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.isActive, true)));
  }

  async getPriceAlert(id: number): Promise<PriceAlert | undefined> {
    const [alert] = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.id, id));
    return alert;
  }

  async createPriceAlert(userId: number, alert: InsertPriceAlert): Promise<PriceAlert> {
    const [newAlert] = await db
      .insert(priceAlerts)
      .values({
        symbol: alert.symbol,
        targetPrice: alert.targetPrice.toString(),
        type: alert.type,
        userId: userId,
        isActive: true
      })
      .returning();
    return newAlert;
  }

  async deactivatePriceAlert(id: number): Promise<void> {
    await db
      .update(priceAlerts)
      .set({ isActive: false, triggeredAt: new Date() })
      .where(eq(priceAlerts.id, id));
  }

  async getCollateralLoans(userId: number): Promise<CollateralLoan[]> {
    return db
      .select()
      .from(collateralLoans)
      .where(eq(collateralLoans.userId, userId));
  }

  async getActiveCollateralLoans(): Promise<CollateralLoan[]> {
    return db
      .select()
      .from(collateralLoans)
      .where(eq(collateralLoans.status, "active"));
  }

  async createCollateralLoan(
    userId: number,
    loan: InsertCollateralLoan
  ): Promise<CollateralLoan> {
    const liquidationMultiplier = 1.5; // Liquidation at 150% of borrowed value
    const annualInterestRate = 0.1; // 10% annual interest rate

    const [newLoan] = await db
      .insert(collateralLoans)
      .values({
        userId,
        collateralSymbol: loan.collateralSymbol,
        collateralAmount: loan.collateralAmount.toString(),
        borrowedSymbol: loan.borrowedSymbol,
        borrowedAmount: loan.borrowedAmount.toString(),
        interestRate: annualInterestRate.toString(),
        dueDate: loan.dueDate,
        liquidationPrice: (loan.borrowedAmount * liquidationMultiplier).toString(),
        status: "active",
      })
      .returning();

    return newLoan;
  }

  async repayCollateralLoan(loanId: number): Promise<void> {
    await db
      .update(collateralLoans)
      .set({ status: "repaid" })
      .where(eq(collateralLoans.id, loanId));
  }

  async liquidateCollateralLoan(loanId: number): Promise<void> {
    await db
      .update(collateralLoans)
      .set({ status: "liquidated" })
      .where(eq(collateralLoans.id, loanId));
  }
}

export const storage = new DatabaseStorage();