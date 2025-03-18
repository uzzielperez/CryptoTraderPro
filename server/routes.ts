import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTradeSchema, insertWatchlistSchema, insertPriceAlertSchema, insertCollateralLoanSchema } from "@shared/schema";
import { calculateRiskMetrics, executeOrder } from "./coinbase-service";
import { generateTradingStrategy } from "./ai-strategy-service";
import { algorithmicTradingService } from "./algorithmic-trading-service";
import type { IncomingMessage } from "http";
import type { Session } from 'express-session';
import { URL } from "url";

interface WebSocketWithSession extends WebSocket {
  isAlive: boolean;
  userId?: number;
}

interface CustomSession extends Session {
  passport?: {
    user?: number;
  };
}

interface SessionIncomingMessage extends IncomingMessage {
  session?: CustomSession;
}

const HEARTBEAT_INTERVAL = 30000;

// Store temporary WS auth tokens with expiration
const wsTokens = new Map<string, { userId: number; expires: number }>();

const TOKEN_EXPIRY = 30000; // 30 seconds

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/user", (req, res) => {
    console.log("Auth status:", req.isAuthenticated(), "User:", req.user);
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  app.get("/api/trades", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const trades = await storage.getTrades(req.user.id);
    res.json(trades);
  });

  app.post("/api/trades", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const validation = insertTradeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }

    try {
      await executeOrder(
        validation.data.type,
        validation.data.symbol,
        Number(validation.data.amount)
      );

      const trade = await storage.createTrade(req.user.id, validation.data);
      await storage.updatePortfolio(
        req.user.id,
        trade.symbol,
        trade.type === "buy" ? Number(trade.amount) : -Number(trade.amount)
      );

      res.status(201).json(trade);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Trade execution failed"
      });
    }
  });

  app.get("/api/risk-metrics/:symbol", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const metrics = await calculateRiskMetrics(req.params.symbol);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to calculate risk metrics"
      });
    }
  });

  app.get("/api/portfolio", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const portfolio = await storage.getPortfolio(req.user.id);
    res.json(portfolio);
  });

  app.get("/api/watchlist", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const watchlist = await storage.getWatchlist(req.user.id);
    res.json(watchlist);
  });

  app.post("/api/watchlist", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const validation = insertWatchlistSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }

    const item = await storage.addToWatchlist(req.user.id, validation.data.symbol);
    res.status(201).json(item);
  });

  app.delete("/api/watchlist/:symbol", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    await storage.removeFromWatchlist(req.user.id, req.params.symbol);
    res.sendStatus(204);
  });

  app.post("/api/trading-strategy", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const { symbol, currentPrice, historicalPrices, technicalIndicators } = req.body;

      if (!symbol || !currentPrice || !historicalPrices) {
        return res.status(400).json({ message: "Missing required data" });
      }

      const strategy = await generateTradingStrategy(
        symbol,
        currentPrice,
        historicalPrices,
        technicalIndicators
      );

      res.json(strategy);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to generate trading strategy"
      });
    }
  });

  app.post("/api/algorithmic-trading/start", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const validation = insertTradingBotSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }

      // Create or update trading bot
      const bot = await db.insert(tradingBots).values({
        userId: req.user.id,
        status: "active",
        ...validation.data
      }).returning();

      // Initialize paper trading account if needed
      if (validation.data.mode === "paper") {
        const [paperAccount] = await db
          .select()
          .from(paperAccounts)
          .where(sql`user_id = ${req.user.id}`);

        if (!paperAccount) {
          await db.insert(paperAccounts).values({
            userId: req.user.id
          });
        }
      }

      // Start the trading strategy
      await algorithmicTradingService.startStrategy(req.user.id, {
        type: validation.data.strategy,
        symbol: validation.data.symbol,
        amount: validation.data.config.riskPerTrade,
        interval: 60000, // 1 minute interval
        params: validation.data.config.parameters
      });

      res.status(201).json(bot);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to start trading strategy"
      });
    }
  });

  app.post("/api/algorithmic-trading/stop", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const { symbol } = req.body;

      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }

      await db
        .update(tradingBots)
        .set({ status: "stopped" })
        .where(sql`user_id = ${req.user.id} AND symbol = ${symbol} AND status = 'active'`);

      await algorithmicTradingService.stopStrategy(req.user.id, symbol);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to stop trading strategy"
      });
    }
  });

  app.get("/api/algorithmic-trading/bots", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const bots = await db
        .select()
        .from(tradingBots)
        .where(sql`user_id = ${req.user.id}`);

      res.json(bots);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch trading bots"
      });
    }
  });

  app.get("/api/algorithmic-trading/trades/:botId", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const botId = parseInt(req.params.botId);
      if (isNaN(botId)) {
        return res.status(400).json({ message: "Invalid bot ID" });
      }

      const [bot] = await db
        .select()
        .from(tradingBots)
        .where(sql`id = ${botId} AND user_id = ${req.user.id}`);

      if (!bot) {
        return res.status(404).json({ message: "Bot not found" });
      }

      const trades = await db
        .select()
        .from(botTrades)
        .where(sql`bot_id = ${botId}`)
        .orderBy(sql`timestamp DESC`)
        .limit(100);

      res.json(trades);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch bot trades"
      });
    }
  });

  app.get("/api/paper-trading/account", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const [account] = await db
        .select()
        .from(paperAccounts)
        .where(sql`user_id = ${req.user.id}`);

      if (!account) {
        return res.status(404).json({ message: "Paper trading account not found" });
      }

      const positions = await db
        .select()
        .from(paperPositions)
        .where(sql`account_id = ${account.id}`);

      res.json({
        balance: account.balance,
        positions
      });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch paper trading account"
      });
    }
  });

  // Add WebSocket auth token endpoint
  app.get("/api/ws-auth", (req, res) => {
    console.log("WS Auth Request - User:", req.user?.id, "Authenticated:", req.isAuthenticated());

    if (!req.isAuthenticated()) {
      console.log("WS Auth Failed - User not authenticated");
      return res.sendStatus(401);
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    wsTokens.set(token, {
      userId: req.user!.id,
      expires: Date.now() + TOKEN_EXPIRY
    });

    console.log("WS Auth Success - Token generated for user:", req.user.id);

    // Clean up expired tokens
    for (const [key, value] of wsTokens.entries()) {
      if (value.expires < Date.now()) {
        wsTokens.delete(key);
      }
    }

    res.json({ token });
  });

  const httpServer = createServer(app);

  // Setup WebSocket server with token authentication
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    verifyClient: async (info, callback) => {
      try {
        const url = new URL(info.req.url!, "ws://localhost");
        const token = url.searchParams.get("token");

        console.log("WS Connection Attempt - Token:", token);

        if (!token) {
          console.log("WS Connection Rejected - No token provided");
          callback(false, 401, "No token provided");
          return;
        }

        const tokenData = wsTokens.get(token);
        console.log("WS Token Data:", tokenData);

        if (!tokenData || tokenData.expires < Date.now()) {
          console.log("WS Connection Rejected - Invalid or expired token");
          wsTokens.delete(token);
          callback(false, 401, "Invalid or expired token");
          return;
        }

        console.log("WS Connection Accepted - User:", tokenData.userId);
        (info.req as any).userId = tokenData.userId;
        callback(true);

      } catch (error) {
        console.error("WS Verification Error:", error);
        callback(false, 500, "Internal Server Error");
      }
    }
  });

  const clients = new Map<number, Set<WebSocketWithSession>>();

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    try {
      const userId = (req as any).userId;

      const wsWithSession = ws as WebSocketWithSession;
      wsWithSession.isAlive = true;
      wsWithSession.userId = userId;

      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)?.add(wsWithSession);

      wsWithSession.send(JSON.stringify({ type: "connected" }));

      wsWithSession.on("pong", () => {
        wsWithSession.isAlive = true;
      });

      wsWithSession.on("close", () => {
        const userConnections = clients.get(userId);
        if (userConnections) {
          userConnections.delete(wsWithSession);
          if (userConnections.size === 0) {
            clients.delete(userId);
          }
        }
      });

    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.close(1011, "Internal server error");
    }
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const wsWithSession = ws as WebSocketWithSession;
      if (!wsWithSession.isAlive) {
        return wsWithSession.terminate();
      }
      wsWithSession.isAlive = false;
      wsWithSession.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  (global as any).priceAlertClients = clients;

  return httpServer;
}