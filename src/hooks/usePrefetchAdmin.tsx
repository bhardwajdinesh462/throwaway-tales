import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryClient';

// Admin query keys for prefetching
const adminQueryKeys = {
  mailboxes: () => ['admin', 'mailboxes'] as const,
  domains: () => ['admin', 'domains'] as const,
  blogs: () => ['admin', 'blogs'] as const,
  emails: () => ['admin', 'emails'] as const,
};

// Prefetch functions
const prefetchFunctions = {
  users: async () => {
    const { data } = await api.db.rpc('get_all_profiles_for_admin', {
      p_search: null,
      p_page: 1,
      p_page_size: 10
    });
    return data;
  },
  
  mailboxes: async () => {
    const { data } = await api.db.query('mailboxes', {
      order: { column: 'priority', ascending: true },
    });
    return data;
  },
  
  domains: async () => {
    const { data } = await api.db.query('domains', {
      order: { column: 'created_at', ascending: false },
    });
    return data;
  },
  
  blogs: async () => {
    const { data } = await api.db.query('blogs', {
      order: { column: 'created_at', ascending: false },
    });
    return data;
  },
  
  emails: async () => {
    const { data } = await api.db.rpc('get_email_logs', {
      p_page: 1,
      p_page_size: 10,
      p_search: null,
      p_status_filter: null
    });
    return data;
  },
};

// Route to prefetch function mapping
const routePrefetchMap: Record<string, { queryKey: readonly unknown[]; fn: () => Promise<unknown> }> = {
  '/admin/users': { queryKey: queryKeys.admin.users(1, ''), fn: prefetchFunctions.users },
  '/admin/mailboxes': { queryKey: adminQueryKeys.mailboxes(), fn: prefetchFunctions.mailboxes },
  '/admin/domains': { queryKey: adminQueryKeys.domains(), fn: prefetchFunctions.domains },
  '/admin/blogs': { queryKey: adminQueryKeys.blogs(), fn: prefetchFunctions.blogs },
  '/admin/email-logs': { queryKey: adminQueryKeys.emails(), fn: prefetchFunctions.emails },
};

export const usePrefetchAdmin = () => {
  const queryClient = useQueryClient();

  const prefetchRoute = useCallback((route: string) => {
    const config = routePrefetchMap[route];
    if (config) {
      // Only prefetch if data is not already in cache or is stale
      const existingData = queryClient.getQueryData(config.queryKey);
      if (!existingData) {
        queryClient.prefetchQuery({
          queryKey: config.queryKey,
          queryFn: config.fn,
          staleTime: 1000 * 60 * 2, // 2 minutes
        });
      }
    }
  }, [queryClient]);

  return { prefetchRoute };
};
