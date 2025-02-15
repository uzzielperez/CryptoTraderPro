import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface RiskMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

interface RiskDashboardProps {
  symbol: string;
}

export function RiskDashboard({ symbol }: RiskDashboardProps) {
  const { data: riskMetrics, isLoading } = useQuery<RiskMetrics>({
    queryKey: [`/api/risk-metrics/${symbol}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!riskMetrics) return null;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low':
        return 'text-green-500';
      case 'Medium':
        return 'text-yellow-500';
      case 'High':
        return 'text-red-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Volatility (24h)</div>
            <div className="text-lg font-semibold">
              {riskMetrics.volatility.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
            <div className="text-lg font-semibold">
              {riskMetrics.sharpeRatio.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Max Drawdown</div>
            <div className="text-lg font-semibold">
              {riskMetrics.maxDrawdown.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Risk Level</div>
            <div className={`text-lg font-semibold ${getRiskColor(riskMetrics.riskLevel)}`}>
              {riskMetrics.riskLevel}
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-muted rounded-md">
          <h4 className="font-semibold mb-2">Risk Analysis</h4>
          <p className="text-sm text-muted-foreground">
            {getRiskSummary(riskMetrics)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function getRiskSummary(metrics: RiskMetrics): string {
  const { riskLevel, volatility, sharpeRatio } = metrics;

  if (riskLevel === 'High') {
    return `High market volatility (${volatility.toFixed(2)}%) indicates increased risk. Consider reducing position size or implementing stop-loss orders.`;
  } else if (riskLevel === 'Medium') {
    return `Moderate market conditions with a Sharpe ratio of ${sharpeRatio.toFixed(2)}. Maintain balanced position sizes and monitor closely.`;
  } else {
    return `Favorable market conditions with low volatility. Good opportunity for strategic position building while maintaining risk management.`;
  }
}