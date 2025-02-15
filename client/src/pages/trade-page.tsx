import { useParams, useLocation } from "wouter";
import { NavSidebar } from "@/components/nav-sidebar";
import { PriceChart } from "@/components/price-chart";
import { TradeForm } from "@/components/trade-form";
import { RiskDashboard } from "@/components/risk-dashboard";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupportedSymbols } from "@/lib/price-service";
import { useState, useEffect } from "react";
import { AIStrategy } from "@/components/ai-strategy";
import { AlgorithmicTrading } from "@/components/algorithmic-trading";
import { PriceAlerts } from "@/components/price-alerts";
import { CollateralLending } from "@/components/collateral-lending";

export default function TradePage() {
  const { symbol } = useParams();
  const [, setLocation] = useLocation();
  const [priceData, setPriceData] = useState<Array<{
    time: string;
    price: number;
  }>>([]);

  const supportedSymbols = getSupportedSymbols();
  const currentSymbol = symbol && supportedSymbols.includes(symbol) ? symbol : "BTC";

  useEffect(() => {
    // Generate mock historical data with more realistic price movements
    const generateMockData = () => {
      const basePrice = {
        BTC: 50000,
        ETH: 3000,
        DOGE: 0.15,
        SOL: 100,
        DOT: 20,
        ADA: 1.2,
        MATIC: 2,
        LINK: 15,
        UNI: 5,
        AVAX: 35
      }[currentSymbol] ?? 100;

      let lastPrice = basePrice;
      const volatility = basePrice * 0.02; // 2% volatility

      return Array.from({ length: 100 }, (_, i) => {
        // Random walk with mean reversion
        const change = (Math.random() - 0.5) * volatility;
        const meanReversion = (basePrice - lastPrice) * 0.1;
        lastPrice = lastPrice + change + meanReversion;

        return {
          time: new Date(Date.now() - (99 - i) * 3600000).toISOString(),
          price: lastPrice
        };
      });
    };

    setPriceData(generateMockData());
  }, [currentSymbol]);

  const handleSymbolChange = (newSymbol: string) => {
    setLocation(`/trade/${newSymbol}`);
  };

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1800px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{currentSymbol}/USD</h1>
            <Select value={currentSymbol} onValueChange={handleSymbolChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select symbol" />
              </SelectTrigger>
              <SelectContent>
                {supportedSymbols.map(sym => (
                  <SelectItem key={sym} value={sym}>
                    {sym}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left and middle panel (2/3): Chart */}
            <div className="col-span-2">
              <Card>
                <CardContent className="pt-6">
                  <PriceChart symbol={currentSymbol} />
                </CardContent>
              </Card>
            </div>

            {/* Right panel (1/3): Trading Form and Risk Dashboard */}
            <div className="space-y-6">
              <TradeForm symbol={currentSymbol} />
              <RiskDashboard symbol={currentSymbol} />
            </div>
          </div>

          {/* Full-width AI Strategy */}
          <AIStrategy
            symbol={currentSymbol}
            currentPrice={priceData[priceData.length - 1]?.price ?? 0}
            historicalPrices={priceData.map(d => d.price)}
            technicalIndicators={{
              sma: priceData[priceData.length - 1]?.price,
              rsi: 50,
              volatility: 2
            }}
          />

          {/* Full-width Collateral Lending */}
          <CollateralLending availableSymbols={supportedSymbols} />

          {/* Full-width Price Alerts */}
          <PriceAlerts symbol={currentSymbol} />

          {/* Full-width Algorithmic Trading */}
          <AlgorithmicTrading symbol={currentSymbol} />

          <TechnicalAnalysis symbol={currentSymbol} data={priceData} />
        </div>
      </main>
    </div>
  );
}