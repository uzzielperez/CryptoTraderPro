import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SMA, RSI, BollingerBands } from 'technicalindicators';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface TechnicalAnalysisProps {
  symbol: string;
  data: Array<{
    time: string;
    price: number;
  }>;
}

export function TechnicalAnalysis({ symbol, data }: TechnicalAnalysisProps) {
  const [indicators, setIndicators] = useState({
    sma: false,
    rsi: false,
    macd: false,
    bollinger: false
  });

  // Calculate indicators
  const chartData = data.map(item => ({
    time: new Date(item.time).toLocaleTimeString(),
    price: item.price,
    sma: null,
    rsi: null,
    upperBand: null,
    lowerBand: null
  }));

  if (indicators.sma) {
    const smaValues = SMA.calculate({
      period: 14,
      values: data.map(d => d.price)
    });

    // Pad the beginning of the SMA data with nulls since SMA needs initial data points
    const smaWithPadding = [...Array(13).fill(null), ...smaValues];
    chartData.forEach((item, index) => {
      item.sma = smaWithPadding[index];
    });
  }

  if (indicators.rsi) {
    const rsiValues = RSI.calculate({
      period: 14,
      values: data.map(d => d.price)
    });

    // Pad the beginning of the RSI data with nulls
    const rsiWithPadding = [...Array(14).fill(null), ...rsiValues];
    chartData.forEach((item, index) => {
      item.rsi = rsiWithPadding[index];
    });
  }

  if (indicators.bollinger) {
    const bollingerValues = BollingerBands.calculate({
      period: 20,
      stdDev: 2,
      values: data.map(d => d.price)
    });

    // Pad the beginning of the Bollinger Bands data with nulls
    const padding = Array(19).fill(null);
    const upperBandWithPadding = [...padding, ...bollingerValues.map(b => b.upper)];
    const lowerBandWithPadding = [...padding, ...bollingerValues.map(b => b.lower)];

    chartData.forEach((item, index) => {
      item.upperBand = upperBandWithPadding[index];
      item.lowerBand = lowerBandWithPadding[index];
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Technical Analysis - {symbol}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.sma}
              onCheckedChange={(checked) => setIndicators(prev => ({ ...prev, sma: checked }))}
            />
            <Label>SMA</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.rsi}
              onCheckedChange={(checked) => setIndicators(prev => ({ ...prev, rsi: checked }))}
            />
            <Label>RSI</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.macd}
              onCheckedChange={(checked) => setIndicators(prev => ({ ...prev, macd: checked }))}
            />
            <Label>MACD</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.bollinger}
              onCheckedChange={(checked) => setIndicators(prev => ({ ...prev, bollinger: checked }))}
            />
            <Label>Bollinger Bands</Label>
          </div>
        </div>

        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(time) => time}
                minTickGap={50}
              />
              <YAxis
                yAxisId="price"
                domain={['auto', 'auto']}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              {indicators.rsi && (
                <YAxis
                  yAxisId="rsi"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
              )}
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'price' || name === 'sma' || name === 'upperBand' || name === 'lowerBand') {
                    return [`$${value.toLocaleString()}`, name.toUpperCase()];
                  }
                  return [value, name.toUpperCase()];
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                yAxisId="price"
                stroke="hsl(var(--primary))"
                dot={false}
              />
              {indicators.sma && (
                <Line
                  type="monotone"
                  dataKey="sma"
                  yAxisId="price"
                  stroke="#2196F3"
                  dot={false}
                  strokeWidth={2}
                />
              )}
              {indicators.rsi && (
                <Line
                  type="monotone"
                  dataKey="rsi"
                  yAxisId="rsi"
                  stroke="#FF5722"
                  dot={false}
                  strokeWidth={2}
                />
              )}
              {indicators.bollinger && (
                <>
                  <Line
                    type="monotone"
                    dataKey="upperBand"
                    yAxisId="price"
                    stroke="#4CAF50"
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="lowerBand"
                    yAxisId="price"
                    stroke="#4CAF50"
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}