import { useQuery, useMutation } from "@tanstack/react-query";
import { Watchlist as WatchlistType } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function Watchlist() {
  const [newSymbol, setNewSymbol] = useState("");
  const { toast } = useToast();
  
  const { data: watchlist } = useQuery<WatchlistType[]>({
    queryKey: ["/api/watchlist"],
  });

  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", "/api/watchlist", { symbol });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setNewSymbol("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add to watchlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      await apiRequest("DELETE", `/api/watchlist/${symbol}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
  });

  if (!watchlist) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watchlist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add symbol (e.g. BTC)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
          />
          <Button
            size="icon"
            onClick={() => newSymbol && addMutation.mutate(newSymbol)}
            disabled={addMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {watchlist.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-muted rounded-md"
            >
              <Link
                href={`/trade/${item.symbol}`}
                className="text-primary hover:underline"
              >
                {item.symbol}
              </Link>
              <div className="flex items-center gap-4">
                <div>${getMockPrice(item.symbol).toFixed(2)}</div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeMutation.mutate(item.symbol)}
                  disabled={removeMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
