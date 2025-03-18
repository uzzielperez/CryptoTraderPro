import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPriceAlertSchema, type PriceAlert } from "@shared/schema";
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
import { Loader2, BellRing, X, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import * as z from 'zod';

type PriceAlertFormData = z.infer<typeof insertPriceAlertSchema>;

export function PriceAlerts({ symbol }: { symbol: string }) {
  const { toast } = useToast();
  const { isConnected } = useWebSocket({
    onMessage: (data) => {
      if (data.type === "price_alert") {
        toast({
          title: "Price Alert",
          description: `${data.symbol} has reached ${data.targetPrice}!`,
        });
        // Refresh alerts list after receiving notification
        queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      }
    }
  });

  const form = useForm<PriceAlertFormData>({
    resolver: zodResolver(insertPriceAlertSchema),
    defaultValues: {
      symbol,
      targetPrice: 0,
      type: "above",
    },
  });

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["/api/price-alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/price-alerts");
      return response.json() as Promise<PriceAlert[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PriceAlertFormData) => {
      const response = await apiRequest("POST", "/api/price-alerts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      form.reset({ symbol, targetPrice: 0, type: "above" });
      toast({
        title: "Alert Created",
        description: "You will be notified when the price target is reached.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await apiRequest("DELETE", `/api/price-alerts/${alertId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      toast({
        title: "Alert Deleted",
        description: "The price alert has been removed.",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Price Alert Management
          {!isConnected && (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Create New Alert</h3>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Target price"
                    {...form.register("targetPrice", { valueAsNumber: true })}
                  />
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value: "above" | "below") =>
                      form.setValue("type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Alert type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Price goes above</SelectItem>
                      <SelectItem value="below">Price goes below</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !isConnected}
                  className="w-full"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create Alert"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Active Alerts</h3>
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : alerts?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No active price alerts
                </div>
              ) : (
                <div className="grid gap-2">
                  {alerts?.map((alert: PriceAlert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between rounded-lg border p-3 bg-card"
                    >
                      <div>
                        <p className="font-medium">{alert.symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.type === "above" ? "Above" : "Below"} $
                          {alert.targetPrice}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(alert.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}