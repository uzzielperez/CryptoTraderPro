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

  app.get("/api/loans", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const loans = await storage.getCollateralLoans(req.user.id);
    res.json(loans);
  });

  app.post("/api/loans", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const validation = insertCollateralLoanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }

    try {
      const portfolio = await storage.getPortfolio(req.user.id);
      const collateralAsset = portfolio.find(
        (p) => p.symbol === validation.data.collateralSymbol
      );

      if (!collateralAsset || Number(collateralAsset.amount) < validation.data.collateralAmount) {
        return res.status(400).json({
          message: "Insufficient collateral balance",
        });
      }

      const loan = await storage.createCollateralLoan(req.user.id, validation.data);

      await storage.updatePortfolio(
        req.user.id,
        validation.data.collateralSymbol,
        -validation.data.collateralAmount
      );

      await storage.updatePortfolio(
        req.user.id,
        validation.data.borrowedSymbol,
        validation.data.borrowedAmount
      );

      res.status(201).json(loan);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to create loan"
      });
    }
  });

  app.post("/api/loans/:id/repay", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const loanId = parseInt(req.params.id);
    if (isNaN(loanId)) {
      return res.status(400).json({ message: "Invalid loan ID" });
    }

    try {
      const loans = await storage.getCollateralLoans(req.user.id);
      const loan = loans.find((l) => l.id === loanId && l.status === "active");

      if (!loan) {
        return res.status(404).json({ message: "Active loan not found" });
      }

      const portfolio = await storage.getPortfolio(req.user.id);
      const borrowedAsset = portfolio.find((p) => p.symbol === loan.borrowedSymbol);

      if (!borrowedAsset || Number(borrowedAsset.amount) < Number(loan.borrowedAmount)) {
        return res.status(400).json({
          message: "Insufficient balance to repay loan",
        });
      }

      await storage.repayCollateralLoan(loanId);

      await storage.updatePortfolio(
        req.user.id,
        loan.collateralSymbol,
        Number(loan.collateralAmount)
      );

      await storage.updatePortfolio(
        req.user.id,
        loan.borrowedSymbol,
        -Number(loan.borrowedAmount)
      );

      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to repay loan"
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