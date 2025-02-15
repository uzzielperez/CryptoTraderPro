import { Client } from 'coinbase';
import { config } from 'dotenv';

let client: Client | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('Coinbase API credentials not found');
    }

    client = new Client({
      apiKey,
      apiSecret,
      strictSSL: true
    });
  }
  return client;
}

export interface RiskMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export async function calculateRiskMetrics(symbol: string): Promise<RiskMetrics> {
  const client = getClient();
  
  return new Promise((resolve, reject) => {
    client.getSpotPrice({ currency_pair: `${symbol}-USD` }, async (err: any, price: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        const currentPrice = parseFloat(price.data.amount);
        const mockVolatility = currentPrice * 0.02; // 2% of current price
        const mockSharpeRatio = 1.5;
        const mockDrawdown = currentPrice * 0.1; // 10% of current price
        
        const riskLevel = mockVolatility > currentPrice * 0.05 ? 'High' : 
                         mockVolatility > currentPrice * 0.02 ? 'Medium' : 'Low';
        
        resolve({
          volatility: mockVolatility,
          sharpeRatio: mockSharpeRatio,
          maxDrawdown: mockDrawdown,
          riskLevel
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function executeOrder(
  type: 'buy' | 'sell',
  currency: string,
  amount: number
): Promise<void> {
  const client = getClient();
  
  return new Promise((resolve, reject) => {
    const params = {
      currency,
      amount: amount.toString()
    };
    
    const method = type === 'buy' ? 'buy' : 'sell';
    
    client[method](params, (err: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
