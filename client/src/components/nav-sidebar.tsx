import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { SiCoinbase } from "react-icons/si";
import {
  LineChart,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

export function NavSidebar() {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Trade",
      href: "/trade/BTC",
      icon: LineChart,
    },
  ];

  return (
    <div className="flex flex-col h-full w-64 bg-sidebar border-r">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <SiCoinbase className="w-8 h-8 text-sidebar-primary" />
          <span className="text-xl font-bold text-sidebar-foreground">
            CryptoTrade
          </span>
        </div>

        <nav className="space-y-2">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start",
                  location === item.href && "bg-sidebar-accent"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground"
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
