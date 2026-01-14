import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Crown, Zap, Building2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface SubscriptionTier {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_temp_emails: number;
  email_expiry_hours: number;
  ai_summaries_per_day: number;
  can_forward_emails: boolean;
  can_use_custom_domains: boolean;
  can_use_api: boolean;
  priority_support: boolean;
  is_active: boolean;
}

const TierComparisonTable = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const { data, error } = await api.db.query<SubscriptionTier[]>('subscription_tiers', {
          filter: { is_active: true },
          order: { column: 'price_monthly', ascending: true },
        });

        if (!error && data) {
          setTiers(data);
        }
      } catch (err) {
        console.error('Failed to fetch tiers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTiers();
  }, []);

  const getTierIcon = (tierName: string) => {
    const name = tierName.toLowerCase();
    if (name.includes('business') || name.includes('enterprise')) return Building2;
    if (name.includes('pro') || name.includes('premium')) return Crown;
    return Zap;
  };

  const getTierColor = (tierName: string) => {
    const name = tierName.toLowerCase();
    if (name.includes('business') || name.includes('enterprise')) return 'text-violet-500';
    if (name.includes('pro') || name.includes('premium')) return 'text-primary';
    return 'text-emerald-500';
  };

  const formatValue = (value: number, type: 'emails' | 'hours' | 'summaries') => {
    if (value === -1) return 'Unlimited';
    if (type === 'hours') {
      if (value >= 24) {
        const days = Math.floor(value / 24);
        return `${days} Day${days > 1 ? 's' : ''}`;
      }
      return `${value} Hour${value > 1 ? 's' : ''}`;
    }
    return value.toString();
  };

  const features = [
    { key: 'max_temp_emails', label: 'Daily Emails', type: 'emails' as const },
    { key: 'email_expiry_hours', label: 'Email Expiry', type: 'hours' as const },
    { key: 'ai_summaries_per_day', label: 'AI Summaries/Day', type: 'summaries' as const },
    { key: 'can_forward_emails', label: 'Email Forwarding', type: 'boolean' as const },
    { key: 'can_use_custom_domains', label: 'Custom Domains', type: 'boolean' as const },
    { key: 'can_use_api', label: 'API Access', type: 'boolean' as const },
    { key: 'priority_support', label: 'Priority Support', type: 'boolean' as const },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="w-full"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Compare <span className="gradient-text">All Features</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
          See exactly what's included in each plan
        </p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-secondary/30">
              <TableHead className="w-[200px] font-semibold text-foreground">Feature</TableHead>
              {tiers.map((tier) => {
                const Icon = getTierIcon(tier.name);
                const colorClass = getTierColor(tier.name);
                return (
                  <TableHead key={tier.id} className="text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`w-5 h-5 ${colorClass}`} />
                      <span className="font-semibold text-foreground">{tier.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ${tier.price_monthly}/mo
                      </span>
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature, index) => (
              <TableRow key={feature.key} className={index % 2 === 0 ? 'bg-secondary/10' : ''}>
                <TableCell className="font-medium text-foreground">{feature.label}</TableCell>
                {tiers.map((tier) => {
                  const value = tier[feature.key as keyof SubscriptionTier];
                  if (feature.type === 'boolean') {
                    return (
                      <TableCell key={tier.id} className="text-center">
                        {value ? (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
                            <Check className="w-4 h-4 text-emerald-500" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/50">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={tier.id} className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={`${
                          (value as number) === -1 
                            ? 'bg-primary/10 text-primary border-primary/20' 
                            : 'bg-secondary text-foreground'
                        }`}
                      >
                        {formatValue(value as number, feature.type)}
                      </Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {tiers.map((tier) => {
          const Icon = getTierIcon(tier.name);
          const colorClass = getTierColor(tier.name);
          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4"
            >
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                <Icon className={`w-6 h-6 ${colorClass}`} />
                <div>
                  <h3 className="font-semibold text-foreground">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">${tier.price_monthly}/mo</p>
                </div>
              </div>
              <div className="space-y-3">
                {features.map((feature) => {
                  const value = tier[feature.key as keyof SubscriptionTier];
                  return (
                    <div key={feature.key} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{feature.label}</span>
                      {feature.type === 'boolean' ? (
                        value ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )
                      ) : (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${
                            (value as number) === -1 
                              ? 'bg-primary/10 text-primary border-primary/20' 
                              : ''
                          }`}
                        >
                          {formatValue(value as number, feature.type)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default TierComparisonTable;
