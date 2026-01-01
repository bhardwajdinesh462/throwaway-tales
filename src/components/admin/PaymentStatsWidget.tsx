import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, CreditCard, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

interface PaymentStats {
  totalRevenue: number;
  revenueThisPeriod: number;
  revenueTrend: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  failedPayments: number;
  failedPaymentsThisPeriod: number;
  averageRevenue: number;
  currency: string;
}

const PaymentStatsWidget = () => {
  const [stats, setStats] = useState<PaymentStats>({
    totalRevenue: 0,
    revenueThisPeriod: 0,
    revenueTrend: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    cancelledSubscriptions: 0,
    failedPayments: 0,
    failedPaymentsThisPeriod: 0,
    averageRevenue: 0,
    currency: "USD",
  });
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPaymentStats = async () => {
      setIsLoading(true);
      try {
        // Calculate date range based on period
        const now = new Date();
        let startDate: Date | null = null;
        
        switch (period) {
          case "7d":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30d":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "90d":
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = null;
        }

        // Fetch invoices
        const invoicesQuery: Record<string, unknown> = {};
        if (startDate) {
          invoicesQuery.filter = { created_at: { gte: startDate.toISOString() } };
        }
        
        const [invoicesRes, allInvoicesRes, subscriptionsRes] = await Promise.all([
          api.db.query<{amount_paid: number; currency: string; status: string; created_at: string}[]>("user_invoices", {
            ...invoicesQuery,
            limit: 1000
          }),
          api.db.query<{amount_paid: number; currency: string; status: string; created_at: string}[]>("user_invoices", { limit: 1000 }),
          api.db.query<{status: string; cancel_at_period_end: boolean}[]>("user_subscriptions", { limit: 1000 }),
        ]);

        const periodInvoices = invoicesRes.data || [];
        const allInvoices = allInvoicesRes.data || [];
        const subscriptions = subscriptionsRes.data || [];

        // Calculate stats
        const totalRevenue = allInvoices
          .filter(inv => inv.status === 'paid')
          .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
        
        const revenueThisPeriod = periodInvoices
          .filter(inv => inv.status === 'paid')
          .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
        
        const failedPayments = allInvoices.filter(inv => inv.status === 'failed').length;
        const failedPaymentsThisPeriod = periodInvoices.filter(inv => inv.status === 'failed').length;
        
        const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
        const cancelledSubscriptions = subscriptions.filter(s => s.status === 'canceled' || s.cancel_at_period_end).length;
        
        // Calculate trend (simplified - compare to previous period)
        let revenueTrend = 0;
        if (startDate && period !== "all") {
          const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
          const previousPeriodInvoices = allInvoices.filter(inv => {
            const invDate = new Date(inv.created_at);
            return invDate >= previousPeriodStart && invDate < startDate! && inv.status === 'paid';
          });
          const previousRevenue = previousPeriodInvoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
          if (previousRevenue > 0) {
            revenueTrend = ((revenueThisPeriod - previousRevenue) / previousRevenue) * 100;
          } else if (revenueThisPeriod > 0) {
            revenueTrend = 100;
          }
        }

        const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
        const averageRevenue = paidInvoices.length > 0 
          ? totalRevenue / paidInvoices.length 
          : 0;

        setStats({
          totalRevenue,
          revenueThisPeriod,
          revenueTrend,
          totalSubscriptions: subscriptions.length,
          activeSubscriptions,
          cancelledSubscriptions,
          failedPayments,
          failedPaymentsThisPeriod,
          averageRevenue,
          currency: allInvoices[0]?.currency?.toUpperCase() || "USD",
        });
      } catch (error) {
        console.error("Error fetching payment stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentStats();
  }, [period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: stats.currency,
    }).format(amount);
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "7d": return "Last 7 Days";
      case "30d": return "Last 30 Days";
      case "90d": return "Last 90 Days";
      default: return "All Time";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Payment Statistics</h2>
            <p className="text-sm text-muted-foreground">{getPeriodLabel()}</p>
          </div>
        </div>
        <Select value={period} onValueChange={(value: "7d" | "30d" | "90d" | "all") => setPeriod(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="bg-secondary/30 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? "..." : formatCurrency(stats.totalRevenue)}
            </div>
            {period !== "all" && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(stats.revenueThisPeriod)} this period
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card className="bg-secondary/30 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {stats.revenueTrend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              Growth Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.revenueTrend >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {isLoading ? "..." : `${stats.revenueTrend >= 0 ? '+' : ''}${stats.revenueTrend.toFixed(1)}%`}
            </div>
            <span className="text-sm text-muted-foreground">vs previous period</span>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card className="bg-secondary/30 border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {isLoading ? "..." : stats.activeSubscriptions}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {stats.cancelledSubscriptions} cancelled
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Failed Payments */}
        <Card className={`bg-secondary/30 border-0 ${stats.failedPaymentsThisPeriod > 0 ? 'ring-1 ring-destructive/50' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Failed Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.failedPaymentsThisPeriod > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {isLoading ? "..." : stats.failedPaymentsThisPeriod}
            </div>
            <span className="text-sm text-muted-foreground">
              {stats.failedPayments} total failures
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="p-4 rounded-lg bg-secondary/20">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-sm">Average Transaction</span>
          </div>
          <div className="text-lg font-semibold text-foreground">
            {isLoading ? "..." : formatCurrency(stats.averageRevenue)}
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-secondary/20">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Monthly Recurring Revenue</span>
          </div>
          <div className="text-lg font-semibold text-foreground">
            {isLoading ? "..." : formatCurrency(stats.activeSubscriptions * stats.averageRevenue)}
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-secondary/20">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm">Conversion Rate</span>
          </div>
          <div className="text-lg font-semibold text-foreground">
            {isLoading ? "..." : stats.totalSubscriptions > 0 
              ? `${((stats.activeSubscriptions / stats.totalSubscriptions) * 100).toFixed(1)}%`
              : "N/A"
            }
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PaymentStatsWidget;
