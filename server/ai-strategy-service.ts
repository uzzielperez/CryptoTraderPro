import OpenAI from "openai";
import { log } from "./vite";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TradingStrategy {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedEntry?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export async function generateTradingStrategy(
  symbol: string,
  currentPrice: number,
  historicalPrices: number[],
  technicalIndicators: {
    sma?: number;
    rsi?: number;
    volatility?: number;
  }
): Promise<TradingStrategy> {
  try {
    const prompt = `
      As a cryptocurrency trading expert, analyze the following market data and provide a trading strategy:

      Asset: ${symbol}
      Current Price: $${currentPrice}
      Technical Indicators:
      - SMA (14): ${technicalIndicators.sma ?? 'N/A'}
      - RSI (14): ${technicalIndicators.rsi ?? 'N/A'}
      - Volatility: ${technicalIndicators.volatility ?? 'N/A'}%

      Recent price trend: ${historicalPrices.slice(-5).join(', ')}

      Provide a detailed trading strategy in JSON format with the following fields:
      - recommendation: either "buy", "sell", or "hold"
      - confidence: number between 0 and 1
      - reasoning: detailed explanation of the strategy
      - suggestedEntry: suggested entry price (optional)
      - stopLoss: recommended stop loss price (optional)
      - takeProfit: recommended take profit price (optional)
      - timeframe: suggested holding period
      - riskLevel: "low", "medium", or "high"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a cryptocurrency trading expert providing analysis and recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const strategy: TradingStrategy = JSON.parse(response.choices[0].message.content);
    return strategy;
  } catch (error) {
    log(`Error generating trading strategy: ${error}`);
    throw new Error("Failed to generate trading strategy");
  }
}
