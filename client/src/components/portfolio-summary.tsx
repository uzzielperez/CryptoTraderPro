import { useQuery } from "@tanstack/react-query";
import { Portfolio } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";

export function PortfolioSummary() {
  const { user } = useAuth();
  const { data: portfolio } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolio"],
  });

  if (!portfolio) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="text-2xl font-bold">${user?.balance.toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">Available Balance</div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {portfolio.map((position) => (
              <TableRow key={position.id}>
                <TableCell>
                  <Link 
                    href={`/trade/${position.symbol}`}
                    className="text-primary hover:underline"
                  >
                    {position.symbol}
                  </Link>
                </TableCell>
                <TableCell>{position.amount}</TableCell>
                <TableCell>
                  ${(position.amount * getMockPrice(position.symbol)).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
