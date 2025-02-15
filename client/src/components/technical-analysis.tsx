import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { SMA, RSI, MACD, BollingerBands } from 'technicalindicators';
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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [indicators, setIndicators] = useState({
    sma: false,
    rsi: false,
    macd: false,
    bollinger: false
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions = {
      layout: {
        textColor: 'black',
        background: { type: ColorType.Solid, color: 'white' }
      },
      width: chartContainerRef.current.clientWidth,
      height: 400
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    const series = chart.addAreaSeries({
      lineColor: 'rgb(2, 192, 118)',
      topColor: 'rgba(2, 192, 118, 0.4)',
      bottomColor: 'rgba(2, 192, 118, 0)',
    });

    series.setData(data.map(item => ({
      time: new Date(item.time).getTime() / 1000,
      value: item.price
    })));

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

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

        <div ref={chartContainerRef} className="w-full h-[400px]" />
      </CardContent>
    </Card>
  );
}