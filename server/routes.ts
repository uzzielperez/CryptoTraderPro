import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTradeSchema, insertWatchlistSchema, insertPriceAlertSchema } from "@shared/schema";
import { calculateRiskMetrics, executeOrder } from "./coinbase-service";
import { generateTradingStrategy } from "./ai-strategy-service";
import { algorithmicTradingService } from "./algorithmic-trading-service";
import type { IncomingMessage } from "http";

interface WebSocketWithSession extends WebSocket {
  isAlive: boolean;
  userId?: number;
}

// Extend Session type to include passport
declare module 'express-session' {
  interface Session {
    passport?: {
      user?: number;
    };
  }
}

interface SessionIncomingMessage extends IncomingMessage {
  session?: Express.Session;
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Trading routes
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
      // Execute order on Coinbase
      await executeOrder(
        validation.data.type,
        validation.data.symbol,
        Number(validation.data.amount)
      );

      // Record trade in our database
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

  // Risk metrics endpoint
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

  // Portfolio routes
  app.get("/api/portfolio", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const portfolio = await storage.getPortfolio(req.user.id);
    res.json(portfolio);
  });

  // Watchlist routes
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

  // Algorithmic trading routes
  app.post("/api/algorithmic-trading/start", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      await algorithmicTradingService.startStrategy(req.user.id, req.body);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to start trading strategy"
      });
    }
  });

  app.post("/api/algorithmic-trading/stop", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      await algorithmicTradingService.stopStrategy(req.user.id, req.body.symbol);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to stop trading strategy"
      });
    }
  });

  // Price Alert routes
  app.get("/api/price-alerts", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const alerts = await storage.getPriceAlerts(req.user.id);
    res.json(alerts);
  });

  app.post("/api/price-alerts", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const validation = insertPriceAlertSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }

    const alert = await storage.createPriceAlert(req.user.id, validation.data);
    res.status(201).json(alert);
  });

  app.delete("/api/price-alerts/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const alertId = parseInt(req.params.id);
    if (isNaN(alertId)) {
      return res.status(400).json({ message: "Invalid alert ID" });
    }

    const alert = await storage.getPriceAlert(alertId);
    if (!alert || alert.userId !== req.user.id) {
      return res.status(404).json({ message: "Alert not found" });
    }

    await storage.deactivatePriceAlert(alertId);
    res.sendStatus(204);
  });

  const httpServer = createServer(app);

  // Setup WebSocket server for real-time price alerts
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: "/ws",
    verifyClient: (info, callback) => {
      const req = info.req as SessionIncomingMessage;
      if (!req.session?.passport?.user) {
        callback(false, 401, 'Unauthorized');
        return;
      }
      callback(true);
    }
  });

  // Keep track of connected clients by user ID
  const clients = new Map<number, Set<WebSocketWithSession>>();

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const sessionReq = req as SessionIncomingMessage;
    const userId = sessionReq.session?.passport?.user;

    if (!userId) {
      ws.close();
      return;
    }

    const wsWithSession = ws as WebSocketWithSession;
    wsWithSession.isAlive = true;
    wsWithSession.userId = userId;

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)?.add(wsWithSession);

    wsWithSession.on("pong", () => {
      wsWithSession.isAlive = true;
    });

    wsWithSession.on("close", () => {
      const userClients = clients.get(userId);
      userClients?.delete(wsWithSession);
      if (userClients?.size === 0) {
        clients.delete(userId);
      }
    });
  });

  // Add WebSocket heartbeat to detect stale connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const wsWithSession = ws as WebSocketWithSession;
      if (!wsWithSession.isAlive) {
        return wsWithSession.terminate();
      }
      wsWithSession.isAlive = false;
      wsWithSession.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  // Expose clients map so price monitoring service can send notifications
  (global as any).priceAlertClients = clients;

  return httpServer;
}