import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";

// Extended query keys for admin
const adminQueryKeys = {
  ...queryKeys.admin,
  mailboxes: () => ['admin', 'mailboxes'] as const,
  domains: () => ['admin', 'domains'] as const,
  blogs: () => ['admin', 'blogs'] as const,
  emails: () => ['admin', 'emails'] as const,
};

// Stale times for different data types
const STALE_TIMES = {
  users: 1000 * 60 * 2, // 2 minutes
  mailboxes: 1000 * 60 * 5, // 5 minutes
  domains: 1000 * 60 * 10, // 10 minutes
  blogs: 1000 * 60 * 5, // 5 minutes
  emails: 1000 * 30, // 30 seconds
};

// Hook for fetching admin users with caching
export const useAdminUsers = (page: number, searchQuery: string, pageSize: number = 10) => {
  return useQuery({
    queryKey: queryKeys.admin.users(page, searchQuery),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_profiles_for_admin', {
        p_search: searchQuery || null,
        p_page: page,
        p_page_size: pageSize
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map((row: any) => row.user_id);
        
        // Fetch suspension and email verification status in parallel
        const [suspensionsResult, profilesResult] = await Promise.all([
          supabase
            .from('user_suspensions')
            .select('user_id')
            .in('user_id', userIds)
            .eq('is_active', true),
          supabase
            .from('profiles')
            .select('user_id, email_verified')
            .in('user_id', userIds)
        ]);

        const suspendedUserIds = new Set(suspensionsResult.data?.map(s => s.user_id) || []);
        const emailVerifiedMap = new Map(profilesResult.data?.map(p => [p.user_id, p.email_verified]) || []);

        return {
          users: data.map((row: any) => ({
            id: row.id,
            user_id: row.user_id,
            email: row.email,
            display_name: row.display_name,
            created_at: row.created_at,
            role: row.role || 'user',
            is_suspended: suspendedUserIds.has(row.user_id),
            email_verified: emailVerifiedMap.get(row.user_id) ?? false
          })),
          totalCount: Number(data[0]?.total_count) || 0
        };
      }

      return { users: [], totalCount: 0 };
    },
    staleTime: STALE_TIMES.users,
    placeholderData: (previousData) => previousData,
  });
};

// Hook for fetching mailboxes with caching
export const useAdminMailboxes = () => {
  return useQuery({
    queryKey: adminQueryKeys.mailboxes(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mailboxes")
        .select("*")
        .order("priority", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIMES.mailboxes,
  });
};

// Hook for fetching domains with caching
export const useAdminDomains = () => {
  return useQuery({
    queryKey: adminQueryKeys.domains(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domains")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIMES.domains,
  });
};

// Hook for fetching blogs with caching
export const useAdminBlogs = () => {
  return useQuery({
    queryKey: adminQueryKeys.blogs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIMES.blogs,
  });
};

// Mutation hooks for domains
export const useDomainMutations = () => {
  const queryClient = useQueryClient();

  const addDomain = useMutation({
    mutationFn: async ({ name, isPremium }: { name: string; isPremium: boolean }) => {
      const domainName = name.startsWith("@") ? name : `@${name}`;
      const { data, error } = await supabase
        .from("domains")
        .insert({
          name: domainName,
          is_premium: isPremium,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("Domain already exists");
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.domains() });
      toast.success("Domain added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add domain");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("domains")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.domains() });
      toast.success(`Domain ${isActive ? "disabled" : "enabled"}`);
    },
    onError: () => {
      toast.error("Failed to update domain");
    },
  });

  const togglePremium = useMutation({
    mutationFn: async ({ id, isPremium }: { id: string; isPremium: boolean }) => {
      const { error } = await supabase
        .from("domains")
        .update({ is_premium: !isPremium })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { isPremium }) => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.domains() });
      toast.success(`Premium status ${isPremium ? "removed" : "added"}`);
    },
    onError: () => {
      toast.error("Failed to update domain");
    },
  });

  const deleteDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.domains() });
      toast.success("Domain deleted");
    },
    onError: () => {
      toast.error("Failed to delete domain");
    },
  });

  return { addDomain, toggleActive, togglePremium, deleteDomain };
};

// Mutation hooks for blogs
export const useBlogMutations = () => {
  const queryClient = useQueryClient();

  const deleteBlog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blogs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.blogs() });
      toast.success("Blog post deleted");
    },
    onError: () => {
      toast.error("Failed to delete blog post");
    },
  });

  const togglePublished = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const newPublished = !published;
      const { error } = await supabase
        .from("blogs")
        .update({
          published: newPublished,
          published_at: newPublished ? new Date().toISOString() : null
        })
        .eq("id", id);

      if (error) throw error;
      return newPublished;
    },
    onSuccess: (newPublished) => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.blogs() });
      toast.success(newPublished ? "Blog published" : "Blog unpublished");
    },
    onError: () => {
      toast.error("Failed to update blog status");
    },
  });

  return { deleteBlog, togglePublished };
};

// Mutation hooks for mailboxes
export const useMailboxMutations = () => {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("mailboxes")
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.mailboxes() });
      toast.success(isActive ? "Mailbox disabled" : "Mailbox enabled");
    },
    onError: () => {
      toast.error("Failed to toggle mailbox");
    },
  });

  const deleteMailbox = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mailboxes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.mailboxes() });
      toast.success("Mailbox deleted");
    },
    onError: () => {
      toast.error("Failed to delete mailbox");
    },
  });

  return { toggleActive, deleteMailbox };
};

export { adminQueryKeys };
