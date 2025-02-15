import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";

interface PriceChartProps {
  symbol: string;
}

export function PriceChart({ symbol }: PriceChartProps) {
  const [data, setData] = useState<any[]>([]);

  // Generate mock price data
  useEffect(() => {
    const basePrice = {
      BTC: 50000,
      ETH: 3000,
      DOGE: 0.15,
    }[symbol] ?? 100;

    const generatePrice = (base: number) => 
      base * (0.9 + Math.random() * 0.2);

    const mockData = Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      price: generatePrice(basePrice),
    }));

    setData(mockData);
  }, [symbol]);

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tickMargin={10}
            className="text-xs"
          />
          <YAxis
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            className="text-xs"
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
