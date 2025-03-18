# AI-Powered Cryptocurrency Trading Platform

A cutting-edge cryptocurrency trading platform that combines advanced AI-powered strategy generation with comprehensive algorithmic trading capabilities. This platform supports both paper trading and live trading, offering intelligent and automated investment tools.

## Features

- 🤖 AI-powered trading strategy generation
- 📊 Advanced technical analysis (SMA, RSI, Bollinger Bands)
- 💹 Real-time price monitoring and alerts
- 📈 Performance heatmap with animated transitions
- 🔄 Multiple trading strategies:
  - Mean Reversion
  - Trend Following
  - Grid Trading
- 📱 Responsive web interface
- 🧪 Paper trading support
- 💼 Multi-cryptocurrency support
- ⚡ WebSocket integration for real-time updates

## Data Sources

The platform utilizes two primary data sources:

### 1. CoinGecko API (Price Data)
- Used for real-time cryptocurrency price data
- Free to use, no API key required
- Supports multiple cryptocurrencies
- Located in `client/src/lib/price-service.ts`
- Default supported symbols: BTC, ETH, DOGE, SOL, DOT, ADA, MATIC, LINK, UNI, AVAX

### 2. Exchange API (Trading Execution)
By default, the platform uses Coinbase, but you can easily integrate other exchanges:

#### Default: Coinbase Integration
1. Create a Coinbase API key with trading permissions
2. Update your `.env`:
```env
COINBASE_API_KEY=your_coinbase_api_key
COINBASE_API_SECRET=your_coinbase_secret
```

#### Alternative Exchange Integration
You can modify `server/coinbase-service.ts` to use a different exchange:

##### Binance Integration Example
1. Install Binance API package:
```bash
npm install binance-api-node
```

2. Update your `.env`:
```env
EXCHANGE_TYPE=binance
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_secret
```

3. Update the exchange service configuration in `server/coinbase-service.ts`:
```typescript
import { Binance } from 'binance-api-node';

export const exchange = new Binance({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET,
});
```

##### Other Supported Exchanges
- KuCoin
- Kraken
- Bitfinex
- FTX


## Getting Started

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- A supported cryptocurrency exchange API key (see Supported Exchanges)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd crypto-trading-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL=postgres://user:password@localhost:5432/dbname
EXCHANGE_API_KEY=your_exchange_api_key
EXCHANGE_API_SECRET=your_exchange_api_secret
EXCHANGE_TYPE=binance # or another supported exchange
OPENAI_API_KEY=your_openai_api_key # Optional, for AI strategy generation
```

4. Initialize the database:
```bash
npm run db:push
```

### Running the Platform

1. Start the development server:
```bash
npm run dev
```

2. Access the platform at `http://localhost:5000`

### Paper Trading

Paper trading is enabled by default. To switch between paper and live trading:

1. Create a new trading bot from the UI
2. Select "paper" or "live" mode
3. Configure your trading strategy
4. Start the bot

Paper trading accounts start with a default balance of 10,000 USD.

### Strategy Configuration

Configure your trading strategies in the UI:

1. Mean Reversion:
   - Lookback period
   - Standard deviation threshold
   - Position size

2. Trend Following:
   - Short/long moving averages
   - Trend strength threshold
   - Stop loss/Take profit levels

3. Grid Trading:
   - Grid size
   - Price range
   - Number of grids

### Risk Management

Set up risk management parameters:
- Maximum position size
- Stop loss levels
- Daily trading limits
- Maximum drawdown

## Security Considerations

1. API Key Security:
   - Use read-only API keys when possible
   - Enable IP whitelisting
   - Regular key rotation
   - Never commit API keys to version control

2. Paper Trading:
   - Always test strategies in paper trading mode first
   - Validate strategy performance before live trading
   - Monitor risk metrics carefully

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details.