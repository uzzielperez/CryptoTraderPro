import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTradeSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPrice } from "@/lib/price-service";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TradeFormProps {
  symbol: string;
}

export function TradeForm({ symbol }: TradeFormProps) {
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertTradeSchema),
    defaultValues: {
      symbol,
      amount: 0,
      price: 0,
      type,
    },
  });

  // Fetch real-time price
  useEffect(() => {
    let isMounted = true;

    async function fetchPrice() {
      try {
        const currentPrice = await getPrice(symbol);
        if (isMounted) {
          setPrice(currentPrice);
          form.setValue("price", currentPrice);
          setIsLoadingPrice(false);
        }
      } catch (error) {
        if (isMounted) {
          setIsLoadingPrice(false);
          toast({
            title: "Error fetching price",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      }
    }

    // Fetch initial price
    fetchPrice();

    // Set up polling for price updates
    const interval = setInterval(fetchPrice, 30000); // Update every 30 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol, form, toast]);

  const tradeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/trades", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Trade executed",
        description: `Successfully ${type} ${symbol}`,
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Trade failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoadingPrice) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => tradeMutation.mutate(data))}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Trade Type</Label>
          <Select
            value={type}
            onValueChange={(value: "buy" | "sell") => {
              setType(value);
              form.setValue("type", value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trade type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.00000001"
            {...form.register("amount", { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label>Price (USD)</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              step="0.01"
              {...form.register("price", { valueAsNumber: true })}
              disabled
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Price updates automatically every 30 seconds
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={tradeMutation.isPending || !price}
        >
          {type === "buy" ? "Buy" : "Sell"} {symbol}
        </Button>
      </form>
    </Form>
  );
}