import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Domain {
  id: string;
  name: string;
  is_premium: boolean;
}

export interface TempEmail {
  id: string;
  address: string;
  domain_id: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface ReceivedEmail {
  id: string;
  temp_email_id: string;
  from_address: string;
  subject: string | null;
  body: string | null;
  html_body: string | null;
  is_read: boolean;
  received_at: string;
}

const generateRandomString = (length: number) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const useEmailService = () => {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [currentEmail, setCurrentEmail] = useState<TempEmail | null>(null);
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch domains
  useEffect(() => {
    const fetchDomains = async () => {
      const { data, error } = await supabase
        .from("domains")
        .select("*")
        .eq("is_active", true)
        .order("is_premium", { ascending: true });

      if (error) {
        console.error("Error fetching domains:", error);
        return;
      }

      setDomains(data || []);
    };

    fetchDomains();
  }, []);

  // Generate new email
  const generateEmail = useCallback(async (domainId?: string) => {
    if (domains.length === 0) return;

    setIsGenerating(true);

    const selectedDomain = domainId 
      ? domains.find(d => d.id === domainId) 
      : domains[0];

    if (!selectedDomain) {
      setIsGenerating(false);
      return;
    }

    const username = generateRandomString(10);
    const address = username + selectedDomain.name;

    try {
      const { data, error } = await supabase
        .from("temp_emails")
        .insert({
          address,
          domain_id: selectedDomain.id,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (error) {
        // If address exists, try again
        if (error.code === "23505") {
          setIsGenerating(false);
          return generateEmail(domainId);
        }
        console.error("Error creating temp email:", error);
        toast.error("Failed to generate email. Please try again.");
        setIsGenerating(false);
        return;
      }

      setCurrentEmail(data);
      setReceivedEmails([]);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  }, [domains, user]);

  // Initial email generation
  useEffect(() => {
    if (domains.length > 0 && !currentEmail) {
      generateEmail();
    }
  }, [domains, currentEmail, generateEmail]);

  // Subscribe to new emails
  useEffect(() => {
    if (!currentEmail) return;

    const channel = supabase
      .channel("received-emails")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "received_emails",
          filter: `temp_email_id=eq.${currentEmail.id}`,
        },
        (payload) => {
          const newEmail = payload.new as ReceivedEmail;
          setReceivedEmails((prev) => [newEmail, ...prev]);
          toast.success("New email received!", {
            description: newEmail.subject || "No subject",
          });
          
          // Play sound notification
          try {
            const audio = new Audio("/notification.mp3");
            audio.play().catch(() => {});
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmail]);

  // Fetch received emails for current temp email
  useEffect(() => {
    if (!currentEmail) return;

    const fetchEmails = async () => {
      const { data, error } = await supabase
        .from("received_emails")
        .select("*")
        .eq("temp_email_id", currentEmail.id)
        .order("received_at", { ascending: false });

      if (error) {
        console.error("Error fetching emails:", error);
        return;
      }

      setReceivedEmails(data || []);
    };

    fetchEmails();
  }, [currentEmail]);

  // Mark email as read
  const markAsRead = async (emailId: string) => {
    const { error } = await supabase
      .from("received_emails")
      .update({ is_read: true })
      .eq("id", emailId);

    if (!error) {
      setReceivedEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, is_read: true } : e))
      );
    }
  };

  // Save email to favorites
  const saveEmail = async (emailId: string) => {
    if (!user) {
      toast.error("Please sign in to save emails");
      return false;
    }

    const { error } = await supabase
      .from("saved_emails")
      .insert({
        user_id: user.id,
        received_email_id: emailId,
      });

    if (error) {
      if (error.code === "23505") {
        toast.info("Email already saved");
      } else {
        toast.error("Failed to save email");
      }
      return false;
    }

    toast.success("Email saved to favorites!");
    return true;
  };

  // Change domain
  const changeDomain = (domainId: string) => {
    generateEmail(domainId);
  };

  return {
    domains,
    currentEmail,
    receivedEmails,
    isLoading,
    isGenerating,
    generateEmail,
    changeDomain,
    markAsRead,
    saveEmail,
  };
};
