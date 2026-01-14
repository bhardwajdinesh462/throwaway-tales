import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn("animate-pulse bg-muted/60 rounded", className)} />
);

// Table row skeleton for user lists
export const AdminTableRowSkeleton = () => (
  <tr className="border-b border-border">
    <td className="p-4 w-12">
      <Skeleton className="h-4 w-4" />
    </td>
    <td className="p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </td>
    <td className="p-4">
      <Skeleton className="h-4 w-32" />
    </td>
    <td className="p-4">
      <Skeleton className="h-8 w-24 rounded-md" />
    </td>
    <td className="p-4">
      <Skeleton className="h-5 w-16 rounded-full" />
    </td>
    <td className="p-4">
      <Skeleton className="h-5 w-16 rounded-full" />
    </td>
    <td className="p-4">
      <Skeleton className="h-4 w-20" />
    </td>
    <td className="p-4 text-right">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </td>
  </tr>
);

// Full table skeleton
export const AdminTableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <AdminTableRowSkeleton key={i} />
    ))}
  </>
);

// Card skeleton for mailboxes, domains, etc.
export const AdminCardSkeleton = () => (
  <div className="glass-card p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  </div>
);

// List of card skeletons
export const AdminCardListSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <AdminCardSkeleton key={i} />
    ))}
  </div>
);

// Mailbox card skeleton with more details
export const AdminMailboxCardSkeleton = () => (
  <div className="glass-card p-4">
    <div className="flex items-center justify-between pb-3 border-b border-border">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-10 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  </div>
);

// Blog post skeleton
export const AdminBlogCardSkeleton = () => (
  <div className="glass-card p-4">
    <div className="flex items-start gap-4">
      <Skeleton className="w-20 h-16 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  </div>
);

// Stats card skeleton
export const AdminStatsCardSkeleton = () => (
  <div className="glass-card p-6 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="p-3 rounded-xl w-12 h-12" />
    </div>
  </div>
);

// Dashboard stats grid skeleton
export const AdminDashboardStatsSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <AdminStatsCardSkeleton key={i} />
    ))}
  </div>
);

// Chart skeleton
export const AdminChartSkeleton = ({ title }: { title?: string }) => (
  <div className="glass-card p-6 animate-pulse">
    {title && <Skeleton className="h-6 w-48 mb-4" />}
    <Skeleton className="h-64 w-full rounded" />
  </div>
);

// Full page loading skeleton with stats + chart
export const AdminPageLoadingSkeleton = ({ 
  statsCount = 4, 
  showChart = true,
  title 
}: { 
  statsCount?: number; 
  showChart?: boolean;
  title?: string;
}) => (
  <div className="space-y-6">
    <AdminDashboardStatsSkeleton count={statsCount} />
    {showChart && <AdminChartSkeleton title={title} />}
    <div className="flex items-center justify-center py-4">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="ml-2 text-muted-foreground text-sm">Loading...</span>
    </div>
  </div>
);

// Domain row skeleton (simpler than full table)
export const AdminDomainSkeleton = () => (
  <div className="glass-card p-4 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <Skeleton className="h-6 w-10 rounded-full" />
      <Skeleton className="h-6 w-10 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  </div>
);

export default {
  AdminTableRowSkeleton,
  AdminTableSkeleton,
  AdminCardSkeleton,
  AdminCardListSkeleton,
  AdminMailboxCardSkeleton,
  AdminBlogCardSkeleton,
  AdminStatsCardSkeleton,
  AdminDashboardStatsSkeleton,
  AdminChartSkeleton,
  AdminPageLoadingSkeleton,
  AdminDomainSkeleton,
};
