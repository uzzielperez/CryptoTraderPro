import { InsertUser, User, Trade, Portfolio, Watchlist, InsertTrade, InsertWatchlist } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private trades: Map<number, Trade[]>;
  private portfolio: Map<number, Portfolio[]>;
  private watchlist: Map<number, Watchlist[]>;
  private currentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.trades = new Map();
    this.portfolio = new Map();
    this.watchlist = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id, balance: 10000 };
    this.users.set(id, user);
    this.trades.set(id, []);
    this.portfolio.set(id, []);
    this.watchlist.set(id, []);
    return user;
  }

  async getTrades(userId: number): Promise<Trade[]> {
    return this.trades.get(userId) || [];
  }

  async createTrade(userId: number, trade: InsertTrade): Promise<Trade> {
    const trades = this.trades.get(userId) || [];
    const id = trades.length + 1;
    const newTrade: Trade = {
      id,
      userId,
      ...trade,
      timestamp: new Date(),
    };
    trades.push(newTrade);
    this.trades.set(userId, trades);
    return newTrade;
  }

  async getPortfolio(userId: number): Promise<Portfolio[]> {
    return this.portfolio.get(userId) || [];
  }

  async updatePortfolio(userId: number, symbol: string, amount: number): Promise<void> {
    let portfolio = this.portfolio.get(userId) || [];
    const existingPosition = portfolio.find(p => p.symbol === symbol);
    
    if (existingPosition) {
      existingPosition.amount += amount;
      if (existingPosition.amount === 0) {
        portfolio = portfolio.filter(p => p.symbol !== symbol);
      }
    } else if (amount !== 0) {
      portfolio.push({
        id: portfolio.length + 1,
        userId,
        symbol,
        amount,
      });
    }
    
    this.portfolio.set(userId, portfolio);
  }

  async getWatchlist(userId: number): Promise<Watchlist[]> {
    return this.watchlist.get(userId) || [];
  }

  async addToWatchlist(userId: number, symbol: string): Promise<Watchlist> {
    const watchlist = this.watchlist.get(userId) || [];
    const id = watchlist.length + 1;
    const newItem: Watchlist = { id, userId, symbol };
    watchlist.push(newItem);
    this.watchlist.set(userId, watchlist);
    return newItem;
  }

  async removeFromWatchlist(userId: number, symbol: string): Promise<void> {
    const watchlist = this.watchlist.get(userId) || [];
    this.watchlist.set(
      userId,
      watchlist.filter((item) => item.symbol !== symbol),
    );
  }
}

export const storage = new MemStorage();
