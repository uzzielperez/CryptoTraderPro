import { useParams } from "wouter";
import { NavSidebar } from "@/components/nav-sidebar";
import { PriceChart } from "@/components/price-chart";
import { TradeForm } from "@/components/trade-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TradePage() {
  const { symbol } = useParams();
  
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
                <div>
                  <TradeForm symbol={symbol} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
