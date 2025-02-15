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
        <div className="max-w-7xl mx-auto space-y-6">
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

          <Card>
            <CardContent className="pt-6">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <PriceChart symbol={currentSymbol} />
                </div>
                <div className="space-y-6">
                  <TradeForm symbol={currentSymbol} />
                  <RiskDashboard symbol={currentSymbol} />
                </div>
              </div>
            </CardContent>
          </Card>

          <TechnicalAnalysis symbol={currentSymbol} data={priceData} />
        </div>
      </main>
    </div>
  );
}