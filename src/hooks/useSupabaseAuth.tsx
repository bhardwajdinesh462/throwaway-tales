// Re-export from new API-based auth for backward compatibility
// This file maintains the same interface but uses fetch() instead of Supabase SDK

export { AuthProvider, useAuth } from './useAuth';
