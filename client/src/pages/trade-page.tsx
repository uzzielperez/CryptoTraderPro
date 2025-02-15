import { useParams } from "wouter";
import { NavSidebar } from "@/components/nav-sidebar";
import { PriceChart } from "@/components/price-chart";
import { TradeForm } from "@/components/trade-form";
import { RiskDashboard } from "@/components/risk-dashboard";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";

export default function TradePage() {
  const { symbol } = useParams();
  const [priceData, setPriceData] = useState<Array<{
    time: string;
    price: number;
  }>>([]);

  useEffect(() => {
    // Generate mock historical data for now
    const generateMockData = () => {
      const basePrice = {
        BTC: 50000,
        ETH: 3000,
        DOGE: 0.15,
      }[symbol ?? "BTC"] ?? 100;

      return Array.from({ length: 100 }, (_, i) => ({
        time: new Date(Date.now() - (99 - i) * 3600000).toISOString(),
        price: basePrice * (0.9 + Math.random() * 0.2),
      }));
    };

    setPriceData(generateMockData());
  }, [symbol]);

  if (!symbol) return null;

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{symbol}/USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <PriceChart symbol={symbol} />
                </div>
                <div className="space-y-6">
                  <TradeForm symbol={symbol} />
                  <RiskDashboard symbol={symbol} />
                </div>
              </div>
            </CardContent>
          </Card>

          <TechnicalAnalysis symbol={symbol} data={priceData} />
        </div>
      </main>
    </div>
  );
}