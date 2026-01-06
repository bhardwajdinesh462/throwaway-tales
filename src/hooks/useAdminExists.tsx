import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAdminExists = () => {
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmins = async () => {
      try {
        const { data, error } = await supabase.rpc('admin_exists');
        
        if (error) {
          console.error('Error checking admin existence:', error);
          // Fallback: assume admin exists to prevent unauthorized access
          setHasAdmin(true);
        } else {
          setHasAdmin(data === true);
        }
      } catch (err) {
        console.error('Error checking admin existence:', err);
        setHasAdmin(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdmins();
  }, []);

  const refetch = async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc('admin_exists');
    setHasAdmin(data === true);
    setIsLoading(false);
  };

  return { hasAdmin, isLoading, refetch };
};
