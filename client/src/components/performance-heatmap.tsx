import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPrices, getSupportedSymbols } from "@/lib/price-service";

interface PerformanceData {
  symbol: string;
  price: number;
  change24h: number;
  marketCap: number;
}

export function PerformanceHeatmap() {
  const [timeframe, setTimeframe] = useState<"1h" | "24h" | "7d">("24h");
  const [sortBy, setSortBy] = useState<"marketCap" | "change">("marketCap");
  const [data, setData] = useState<PerformanceData[]>([]);

  useEffect(() => {
    // Function to fetch and update performance data
    const fetchData = async () => {
      try {
        const symbols = getSupportedSymbols();
        const prices = await getPrices(symbols);
        
        // For now, using mock market cap data
        const mockMarketCap = {
          BTC: 1000000000000,
          ETH: 500000000000,
          DOGE: 10000000000,
          // Add more as needed
        };

        const performanceData: PerformanceData[] = symbols.map(symbol => ({
          symbol,
          price: prices[symbol] || 0,
          change24h: (Math.random() * 20) - 10, // Mock 24h change between -10% and +10%
          marketCap: mockMarketCap[symbol] || 1000000000,
        }));

        // Sort data based on selected criterion
        const sortedData = [...performanceData].sort((a, b) => 
          sortBy === "marketCap" 
            ? b.marketCap - a.marketCap 
            : Math.abs(b.change24h) - Math.abs(a.change24h)
        );

        setData(sortedData);
      } catch (error) {
        console.error("Error fetching performance data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [sortBy]);

  const getColorForChange = (change: number) => {
    const intensity = Math.min(Math.abs(change) * 10, 100);
    return change > 0
      ? `rgba(34, 197, 94, ${intensity / 100})`  // Green
      : `rgba(239, 68, 68, ${intensity / 100})`; // Red
  };

  const getSizeClass = (marketCap: number) => {
    if (marketCap > 500000000000) return "col-span-2 row-span-2"; // Large
    if (marketCap > 100000000000) return "col-span-2"; // Medium
    return "col-span-1"; // Small
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Market Performance</CardTitle>
        <div className="flex gap-2">
          <Select value={timeframe} onValueChange={(value: "1h" | "24h" | "7d") => setTimeframe(value)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1H</SelectItem>
              <SelectItem value="24h">24H</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: "marketCap" | "change") => setSortBy(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marketCap">Market Cap</SelectItem>
              <SelectItem value="change">% Change</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <AnimatePresence>
            {data.map((item) => (
              <motion.div
                key={item.symbol}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className={`${getSizeClass(item.marketCap)} relative p-4 rounded-lg`}
                style={{
                  backgroundColor: getColorForChange(item.change24h),
                }}
              >
                <div className="flex flex-col">
                  <span className="text-lg font-bold">{item.symbol}</span>
                  <span className="text-sm opacity-90">${item.price.toLocaleString()}</span>
                  <span className={`text-sm font-medium ${item.change24h > 0 ? "text-green-100" : "text-red-100"}`}>
                    {item.change24h > 0 ? "+" : ""}{item.change24h.toFixed(2)}%
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
