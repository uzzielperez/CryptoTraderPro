import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCollateralLoanSchema, type CollateralLoan } from "@shared/schema";
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
import { Loader2, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CollateralLoanFormData = {
  collateralSymbol: string;
  collateralAmount: number;
  borrowedSymbol: string;
  borrowedAmount: number;
  dueDate: Date;
};

export function CollateralLending({ availableSymbols }: { availableSymbols: string[] }) {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();

  const form = useForm<CollateralLoanFormData>({
    resolver: zodResolver(insertCollateralLoanSchema),
    defaultValues: {
      collateralAmount: 0,
      borrowedAmount: 0,
    },
  });

  const { data: loans, isLoading: isLoadingLoans } = useQuery({
    queryKey: ["/api/loans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/loans");
      return response.json() as Promise<CollateralLoan[]>;
    },
  });

  const createLoanMutation = useMutation({
    mutationFn: async (data: CollateralLoanFormData) => {
      const response = await apiRequest("POST", "/api/loans", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      toast({
        title: "Loan Created",
        description: "Your collateral loan has been created successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create loan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const repayLoanMutation = useMutation({
    mutationFn: async (loanId: number) => {
      await apiRequest("POST", `/api/loans/${loanId}/repay`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      toast({
        title: "Loan Repaid",
        description: "Your loan has been repaid successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to repay loan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Collateral Lending
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Create New Loan</h3>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createLoanMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Select
                      value={form.watch("collateralSymbol")}
                      onValueChange={(value: string) =>
                        form.setValue("collateralSymbol", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Collateral Asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSymbols.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="Collateral Amount"
                      {...form.register("collateralAmount", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={form.watch("borrowedSymbol")}
                      onValueChange={(value: string) =>
                        form.setValue("borrowedSymbol", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Borrow Asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSymbols.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="Borrow Amount"
                      {...form.register("borrowedAmount", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      {date ? format(date, "PPP") : <span>Due Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(date) => {
                        setDate(date);
                        if (date) {
                          form.setValue("dueDate", date);
                        }
                      }}
                      disabled={(date) =>
                        date < new Date() || date > new Date(2025, 12, 31)
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createLoanMutation.isPending}
                >
                  {createLoanMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create Loan"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Active Loans</h3>
            <div className="space-y-2">
              {isLoadingLoans ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !loans?.length ? (
                <div className="text-center py-4 text-muted-foreground">
                  No active loans
                </div>
              ) : (
                <div className="grid gap-2">
                  {loans
                    .filter((loan) => loan.status === "active")
                    .map((loan) => (
                      <div
                        key={loan.id}
                        className="flex flex-col gap-2 rounded-lg border p-4 bg-card"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {loan.collateralAmount} {loan.collateralSymbol}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Borrowed: {loan.borrowedAmount} {loan.borrowedSymbol}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => repayLoanMutation.mutate(loan.id)}
                            disabled={repayLoanMutation.isPending}
                          >
                            {repayLoanMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Repay"
                            )}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Interest Rate: {Number(loan.interestRate) * 100}%</p>
                          <p>
                            Due Date:{" "}
                            {format(new Date(loan.dueDate), "MMM d, yyyy")}
                          </p>
                        </div>
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
