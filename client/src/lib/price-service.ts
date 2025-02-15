import axios from "axios";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

interface CoinGeckoPrice {
  [key: string]: {
    usd: number;
  };
}

// Map our symbol to CoinGecko's ID
const symbolToId: { [key: string]: string } = {
  BTC: "bitcoin",
  ETH: "ethereum",
  DOGE: "dogecoin",
  SOL: "solana",
  DOT: "polkadot",
  ADA: "cardano",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  AVAX: "avalanche-2"
};

export async function getPrice(symbol: string): Promise<number> {
  try {
    const id = symbolToId[symbol];
    if (!id) {
      throw new Error(`Unsupported symbol: ${symbol}`);
    }

    const response = await axios.get<CoinGeckoPrice>(
      `${COINGECKO_API_BASE}/simple/price`,
      {
        params: {
          ids: id,
          vs_currencies: "usd",
        },
      }
    );

    const price = response.data[id]?.usd;
    if (!price) {
      throw new Error(`No price data for ${symbol}`);
    }

    return price;
  } catch (error) {
    console.error(`Failed to fetch price for ${symbol}:`, error);
    throw new Error(`Failed to fetch price for ${symbol}`);
  }
}

export async function getPrices(symbols: string[]): Promise<{ [key: string]: number }> {
  try {
    const ids = symbols.map(symbol => symbolToId[symbol]).filter(Boolean);
    if (ids.length === 0) {
      return {};
    }

    const response = await axios.get<CoinGeckoPrice>(
      `${COINGECKO_API_BASE}/simple/price`,
      {
        params: {
          ids: ids.join(","),
          vs_currencies: "usd",
        },
      }
    );

    const prices: { [key: string]: number } = {};
    symbols.forEach(symbol => {
      const id = symbolToId[symbol];
      if (id && response.data[id]) {
        prices[symbol] = response.data[id].usd;
      }
    });

    return prices;
  } catch (error) {
    console.error("Failed to fetch prices:", error);
    throw new Error("Failed to fetch cryptocurrency prices");
  }
}

// Get supported symbols
export function getSupportedSymbols(): string[] {
  return Object.keys(symbolToId);
}
