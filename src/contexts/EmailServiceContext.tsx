import React, { createContext, useContext } from "react";
import { useSecureEmailService } from "@/hooks/useSecureEmailService";

type EmailServiceContextValue = ReturnType<typeof useSecureEmailService>;

const EmailServiceContext = createContext<EmailServiceContextValue | null>(null);

export function EmailServiceProvider({ children }: { children: React.ReactNode }) {
  const value = useSecureEmailService();
  return <EmailServiceContext.Provider value={value}>{children}</EmailServiceContext.Provider>;
}

export function useEmailService() {
  const ctx = useContext(EmailServiceContext);
  if (!ctx) throw new Error("useEmailService must be used within EmailServiceProvider");
  return ctx;
}
