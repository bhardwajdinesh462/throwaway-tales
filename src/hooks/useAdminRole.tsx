import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";

export const useAdminRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsModerator(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error checking user role:', error);
          setIsAdmin(false);
          setIsModerator(false);
        } else {
          setIsAdmin(data?.role === 'admin');
          setIsModerator(data?.role === 'moderator' || data?.role === 'admin');
        }
      } catch (err) {
        console.error('Error in useAdminRole:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkRole();
  }, [user]);

  return { isAdmin, isModerator, isLoading };
};

export default useAdminRole;
