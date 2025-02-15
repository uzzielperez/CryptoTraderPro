import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, LineStyle } from 'lightweight-charts';
import { SMA, RSI, MACD, BollingerBands } from 'technicalindicators';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [indicators, setIndicators] = useState({
    sma: false,
    rsi: false,
    macd: false,
    bollinger: false
  });

  // Initialize chart
  useEffect(() => {
    if (chartContainerRef.current) {
      const newChart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: 'transparent' },
          textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
          vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
          horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
        },
      });

      const mainSeries = newChart.addCandlestickSeries();
      mainSeries.setData(data.map(d => ({
        time: d.time,
        open: d.price,
        high: d.price * 1.001,
        low: d.price * 0.999,
        close: d.price
      })));

      setChart(newChart);

      return () => {
        newChart.remove();
      };
    }
  }, [data]);

  // Handle indicator toggles
  const toggleIndicator = (name: keyof typeof indicators) => {
    if (!chart) return;

    setIndicators(prev => {
      const newState = { ...prev, [name]: !prev[name] };
      
      // Calculate and display indicators
      if (newState[name]) {
        switch (name) {
          case 'sma':
            const smaData = SMA.calculate({
              period: 14,
              values: data.map(d => d.price)
            });
            const smaLine = chart.addLineSeries({
              color: 'rgba(4, 111, 232, 1)',
              lineWidth: 2,
            });
            smaLine.setData(
              smaData.map((value, index) => ({
                time: data[index + 13].time,
                value
              }))
            );
            break;

          case 'rsi':
            const rsiData = RSI.calculate({
              period: 14,
              values: data.map(d => d.price)
            });
            const rsiLine = chart.addLineSeries({
              color: 'rgba(255, 99, 132, 1)',
              lineWidth: 2,
            });
            rsiLine.setData(
              rsiData.map((value, index) => ({
                time: data[index + 13].time,
                value
              }))
            );
            break;

          // Add other indicators similarly
        }
      }

      return newState;
    });
  };

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
              onCheckedChange={() => toggleIndicator('sma')}
            />
            <Label>SMA</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.rsi}
              onCheckedChange={() => toggleIndicator('rsi')}
            />
            <Label>RSI</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.macd}
              onCheckedChange={() => toggleIndicator('macd')}
            />
            <Label>MACD</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={indicators.bollinger}
              onCheckedChange={() => toggleIndicator('bollinger')}
            />
            <Label>Bollinger Bands</Label>
          </div>
        </div>
        
        <div ref={chartContainerRef} className="w-full h-[400px]" />
      </CardContent>
    </Card>
  );
}
