import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const strategySchema = z.object({
  type: z.enum(["MA_CROSSOVER", "RSI_OVERSOLD", "BOLLINGER_BOUNCE"]),
  symbol: z.string(),
  amount: z.number().positive(),
  interval: z.number().int().positive(),
  params: z.object({
    shortPeriod: z.number().int().positive().optional(),
    longPeriod: z.number().int().positive().optional(),
    rsiPeriod: z.number().int().positive().optional(),
    oversoldThreshold: z.number().positive().optional(),
    overboughtThreshold: z.number().positive().optional(),
    deviations: z.number().positive().optional(),
  }),
});

type StrategyConfig = z.infer<typeof strategySchema>;

export function AlgorithmicTrading({ symbol }: { symbol: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const form = useForm<StrategyConfig>({
    resolver: zodResolver(strategySchema),
    defaultValues: {
      type: "MA_CROSSOVER",
      symbol,
      amount: 0.001,
      interval: 60000, // 1 minute
      params: {
        shortPeriod: 10,
        longPeriod: 20,
      },
    },
  });

  const startMutation = useMutation({
    mutationFn: async (data: StrategyConfig) => {
      await apiRequest("POST", "/api/algorithmic-trading/start", data);
    },
    onSuccess: () => {
      setIsRunning(true);
      toast({
        title: "Strategy started",
        description: "The algorithmic trading strategy is now running",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start strategy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/algorithmic-trading/stop", { symbol });
    },
    onSuccess: () => {
      setIsRunning(false);
      toast({
        title: "Strategy stopped",
        description: "The algorithmic trading strategy has been stopped",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop strategy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StrategyConfig) => {
    if (isRunning) {
      stopMutation.mutate();
    } else {
      startMutation.mutate(data);
    }
  };

  const strategyType = form.watch("type");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Algorithmic Trading</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Select
                value={strategyType}
                onValueChange={(value: StrategyConfig["type"]) => {
                  form.setValue("type", value);
                  // Reset params based on strategy type
                  switch (value) {
                    case "MA_CROSSOVER":
                      form.setValue("params", {
                        shortPeriod: 10,
                        longPeriod: 20,
                      });
                      break;
                    case "RSI_OVERSOLD":
                      form.setValue("params", {
                        rsiPeriod: 14,
                        oversoldThreshold: 30,
                        overboughtThreshold: 70,
                      });
                      break;
                    case "BOLLINGER_BOUNCE":
                      form.setValue("params", {
                        period: 20,
                        deviations: 2,
                      });
                      break;
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MA_CROSSOVER">Moving Average Crossover</SelectItem>
                  <SelectItem value="RSI_OVERSOLD">RSI Overbought/Oversold</SelectItem>
                  <SelectItem value="BOLLINGER_BOUNCE">Bollinger Bands Bounce</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Input
                type="number"
                step="0.00000001"
                placeholder="Trading amount"
                {...form.register("amount", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Input
                type="number"
                step="1000"
                placeholder="Check interval (ms)"
                {...form.register("interval", { valueAsNumber: true })}
              />
            </div>

            {strategyType === "MA_CROSSOVER" && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Short period"
                  {...form.register("params.shortPeriod", { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  placeholder="Long period"
                  {...form.register("params.longPeriod", { valueAsNumber: true })}
                />
              </div>
            )}

            {strategyType === "RSI_OVERSOLD" && (
              <div className="grid grid-cols-3 gap-4">
                <Input
                  type="number"
                  placeholder="RSI period"
                  {...form.register("params.rsiPeriod", { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  placeholder="Oversold threshold"
                  {...form.register("params.oversoldThreshold", { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  placeholder="Overbought threshold"
                  {...form.register("params.overboughtThreshold", { valueAsNumber: true })}
                />
              </div>
            )}

            {strategyType === "BOLLINGER_BOUNCE" && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Period"
                  {...form.register("params.period", { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Standard deviations"
                  {...form.register("params.deviations", { valueAsNumber: true })}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={startMutation.isPending || stopMutation.isPending}
            >
              {startMutation.isPending || stopMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRunning ? (
                "Stop Strategy"
              ) : (
                "Start Strategy"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
