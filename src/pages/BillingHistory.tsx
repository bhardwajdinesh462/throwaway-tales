import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Download, ExternalLink, FileText, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import SEOHead from "@/components/SEOHead";

interface Invoice {
  id: string;
  stripe_invoice_id: string | null;
  amount_paid: number;
  currency: string;
  status: string;
  description: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  paid_at: string | null;
}

const BillingHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user) return;

      const { data, error } = await api.db.query<Invoice[]>('user_invoices', {
        filter: { user_id: user.id },
        order: { column: 'created_at', ascending: false }
      });

      if (error) {
        console.error("Error fetching invoices:", error);
      } else {
        setInvoices(data || []);
      }
      setIsLoading(false);
    };

    fetchInvoices();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Paid</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Please sign in to view your billing history.</p>
            <Button className="mt-4" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Billing History | Your Invoices"
        description="View your billing history, past invoices, and payment records."
      />
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>View your past invoices and payments</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No invoices yet</h3>
                <p className="text-muted-foreground mb-4">
                  Your billing history will appear here once you make a payment.
                </p>
                <Button onClick={() => navigate("/pricing")}>View Plans</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {format(new Date(invoice.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{invoice.description || "Subscription payment"}</TableCell>
                        <TableCell>
                          {invoice.period_start && invoice.period_end ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(invoice.period_start), "MMM d")} -{" "}
                              {format(new Date(invoice.period_end), "MMM d, yyyy")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(invoice.amount_paid, invoice.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {invoice.invoice_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                              >
                                <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {invoice.invoice_pdf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                              >
                                <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default BillingHistory;
