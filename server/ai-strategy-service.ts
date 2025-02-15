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

      Provide a detailed trading strategy with the following EXACT JSON format (no markdown, no extra text):
      {
        "recommendation": "buy" or "sell" or "hold",
        "confidence": number between 0 and 1,
        "reasoning": "detailed explanation",
        "suggestedEntry": optional number,
        "stopLoss": optional number,
        "takeProfit": optional number,
        "timeframe": "string describing time period",
        "riskLevel": "low" or "medium" or "high"
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a cryptocurrency trading expert providing analysis and recommendations. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    try {
      // Find the JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const strategy: TradingStrategy = JSON.parse(jsonMatch[0]);
      return strategy;
    } catch (parseError) {
      log(`Error parsing AI response: ${content}`);
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    log(`Error generating trading strategy: ${error}`);
    throw new Error("Failed to generate trading strategy");
  }
}