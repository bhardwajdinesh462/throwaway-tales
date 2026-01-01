import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { api } from "@/lib/api";

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
        const { data, error } = await api.db.query<{role: string}[]>('user_roles', {
          filter: { user_id: user.id },
          limit: 1
        });

        if (error) {
          console.error('Error checking user role:', error);
          setIsAdmin(false);
          setIsModerator(false);
        } else {
          const role = data?.[0]?.role;
          setIsAdmin(role === 'admin');
          setIsModerator(role === 'moderator' || role === 'admin');
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
