import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPriceAlertSchema } from "@shared/schema";
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
import { Loader2, BellRing, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type PriceAlertFormData = {
  symbol: string;
  targetPrice: string;
  type: "above" | "below";
};

export function PriceAlerts({ symbol }: { symbol: string }) {
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Connect to WebSocket for real-time alerts
  useState(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const alert = JSON.parse(event.data);
      toast({
        title: "Price Alert",
        description: `${alert.symbol} has reached ${alert.targetPrice}!`,
      });
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const form = useForm<PriceAlertFormData>({
    resolver: zodResolver(insertPriceAlertSchema),
    defaultValues: {
      symbol,
      targetPrice: "",
      type: "above",
    },
  });

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["/api/price-alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/price-alerts");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PriceAlertFormData) => {
      const response = await apiRequest("POST", "/api/price-alerts", {
        ...data,
        targetPrice: parseFloat(data.targetPrice),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-alerts"] });
      form.reset();
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
          Price Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-4">
              <Input
                type="number"
                step="0.01"
                placeholder="Target price"
                {...form.register("targetPrice")}
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
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Alert"
                )}
              </Button>
            </div>
          </form>
        </Form>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts?.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No active price alerts
            </p>
          ) : (
            alerts?.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg border p-3"
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
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
