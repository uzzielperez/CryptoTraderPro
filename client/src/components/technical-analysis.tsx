import { useEffect, useRef, useState } from 'react';
import { 
  createChart,
  IChartApi,
  ColorType,
  CandlestickSeriesOptions,
  SeriesOptionsCommon
} from 'lightweight-charts';
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
  const [chartInstance, setChartInstance] = useState<IChartApi | null>(null);
  const [indicators, setIndicators] = useState({
    sma: false,
    rsi: false,
    macd: false,
    bollinger: false
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        textColor: 'black',
        background: { type: ColorType.Solid, color: 'white' }
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      grid: {
        vertLines: { color: '#E6E6E6' },
        horzLines: { color: '#E6E6E6' }
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    });

    // Convert price data to OHLC format
    const candleData = data.map(item => ({
      time: Math.floor(new Date(item.time).getTime() / 1000),
      open: item.price,
      high: item.price * 1.002, // Simulate high price
      low: item.price * 0.998,  // Simulate low price
      close: item.price
    }));

    candlestickSeries.setData(candleData);
    setChartInstance(chart);

    // Add SMA indicator if enabled
    if (indicators.sma) {
      const smaData = SMA.calculate({
        period: 14,
        values: data.map(d => d.price)
      });

      const smaLineSeries = chart.addBaselineSeries({
        baseValue: { type: 'price', price: 0 },
        lineWidth: 2,
        color: 'rgba(4, 111, 232, 1)'
      });

      smaLineSeries.setData(
        smaData.map((value, index) => ({
          time: Math.floor(new Date(data[index + 13].time).getTime() / 1000),
          value: value
        }))
      );
    }

    // Handle window resize
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
  }, [data, indicators.sma]); // Re-create chart when data or SMA indicator changes

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