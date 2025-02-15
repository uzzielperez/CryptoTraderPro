import { NavSidebar } from "@/components/nav-sidebar";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { Watchlist } from "@/components/watchlist";
import { PerformanceHeatmap } from "@/components/performance-heatmap";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.username}
          </h1>
          <div className="grid lg:grid-cols-2 gap-6">
            <PortfolioSummary />
            <Watchlist />
          </div>
          {/* Add Performance Heatmap below the portfolio and watchlist */}
          <PerformanceHeatmap />
        </div>
      </main>
    </div>
  );
}