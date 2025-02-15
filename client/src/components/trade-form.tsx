import { useState } from "react";
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
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(insertTradeSchema),
    defaultValues: {
      symbol,
      amount: 0,
      price: getMockPrice(symbol),
      type,
    },
  });

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
              <SelectValue />
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
          <Input
            type="number"
            step="0.01"
            {...form.register("price", { valueAsNumber: true })}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={tradeMutation.isPending}
        >
          {type === "buy" ? "Buy" : "Sell"} {symbol}
        </Button>
      </form>
    </Form>
  );
}

// Mock price function - in a real app this would come from an API
function getMockPrice(symbol: string): number {
  const basePrice = {
    BTC: 50000,
    ETH: 3000,
    DOGE: 0.15,
  }[symbol] ?? 100;
  
  return basePrice * (0.9 + Math.random() * 0.2);
}
