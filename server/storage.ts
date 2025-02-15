import { InsertUser, User, Trade, Portfolio, Watchlist, InsertTrade, InsertWatchlist, InsertPriceAlert, PriceAlert } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { users, trades, portfolio, watchlist, priceAlerts } from "@shared/schema";
import { pool } from "./db";

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
      .values({ ...alert, userId })
      .returning();
    return newAlert;
  }

  async deactivatePriceAlert(id: number): Promise<void> {
    await db
      .update(priceAlerts)
      .set({ isActive: false, triggeredAt: new Date() })
      .where(eq(priceAlerts.id, id));
  }
}

export const storage = new DatabaseStorage();