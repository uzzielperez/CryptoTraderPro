import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AIStrategyProps {
  symbol: string;
  currentPrice: number;
  historicalPrices: number[];
  technicalIndicators: {
    sma?: number;
    rsi?: number;
    volatility?: number;
  };
}

export function AIStrategy({ 
  symbol, 
  currentPrice, 
  historicalPrices,
  technicalIndicators 
}: AIStrategyProps) {
  const { toast } = useToast();

  const strategyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading-strategy", {
        symbol,
        currentPrice,
        historicalPrices,
        technicalIndicators
      });
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate strategy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-500/10 text-green-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'high':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy':
        return 'bg-green-500/10 text-green-500';
      case 'sell':
        return 'bg-red-500/10 text-red-500';
      case 'hold':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI Trading Strategy
          </CardTitle>
          <Button
            size="sm"
            onClick={() => strategyMutation.mutate()}
            disabled={strategyMutation.isPending}
          >
            {strategyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Generate Strategy"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {strategyMutation.data ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={getActionColor(strategyMutation.data.recommendation)}>
                {strategyMutation.data.recommendation.toUpperCase()}
              </Badge>
              <Badge className={getRiskColor(strategyMutation.data.riskLevel)}>
                {strategyMutation.data.riskLevel} Risk
              </Badge>
              <Badge variant="outline">
                {Math.round(strategyMutation.data.confidence * 100)}% Confidence
              </Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              {strategyMutation.data.reasoning}
            </div>

            {(strategyMutation.data.suggestedEntry || 
              strategyMutation.data.stopLoss || 
              strategyMutation.data.takeProfit) && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                {strategyMutation.data.suggestedEntry && (
                  <div>
                    <div className="text-sm text-muted-foreground">Entry Price</div>
                    <div className="font-semibold">
                      ${strategyMutation.data.suggestedEntry.toFixed(2)}
                    </div>
                  </div>
                )}
                {strategyMutation.data.stopLoss && (
                  <div>
                    <div className="text-sm text-muted-foreground">Stop Loss</div>
                    <div className="font-semibold">
                      ${strategyMutation.data.stopLoss.toFixed(2)}
                    </div>
                  </div>
                )}
                {strategyMutation.data.takeProfit && (
                  <div>
                    <div className="text-sm text-muted-foreground">Take Profit</div>
                    <div className="font-semibold">
                      ${strategyMutation.data.takeProfit.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2">
              <div className="text-sm text-muted-foreground">Timeframe</div>
              <div className="font-semibold">{strategyMutation.data.timeframe}</div>
            </div>
          </div>
        ) : !strategyMutation.isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>Click 'Generate Strategy' for AI-powered trading recommendations</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
