export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      admin_role_requests: {
        Row: {
          created_at: string
          existing_role: string | null
          id: string
          reason: string | null
          requested_role: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          existing_role?: string | null
          id?: string
          reason?: string | null
          requested_role: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          existing_role?: string | null
          id?: string
          reason?: string | null
          requested_role?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      banners: {
        Row: {
          click_count: number
          content: string
          created_at: string
          end_date: string | null
          height: number | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          name: string
          position: string
          priority: number
          size_name: string | null
          start_date: string | null
          type: string
          updated_at: string
          view_count: number
          width: number | null
        }
        Insert: {
          click_count?: number
          content: string
          created_at?: string
          end_date?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          name: string
          position: string
          priority?: number
          size_name?: string | null
          start_date?: string | null
          type: string
          updated_at?: string
          view_count?: number
          width?: number | null
        }
        Update: {
          click_count?: number
          content?: string
          created_at?: string
          end_date?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          name?: string
          position?: string
          priority?: number
          size_name?: string | null
          start_date?: string | null
          type?: string
          updated_at?: string
          view_count?: number
          width?: number | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_by: string
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string
          is_active: boolean
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address: string
          is_active?: boolean
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean
          reason?: string | null
        }
        Relationships: []
      }
      blogs: {
        Row: {
          author: string
          category: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published: boolean | null
          published_at: string | null
          reading_time: number | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author: string
          category?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean | null
          published_at?: string | null
          reading_time?: number | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string
          category?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean | null
          published_at?: string | null
          reading_time?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_premium: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          name?: string
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          received_email_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          received_email_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          received_email_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_received_email_id_fkey"
            columns: ["received_email_id"]
            isOneToOne: false
            referencedRelation: "received_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_forwarding: {
        Row: {
          created_at: string
          forward_to_address: string
          id: string
          is_active: boolean
          temp_email_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forward_to_address: string
          id?: string
          is_active?: boolean
          temp_email_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forward_to_address?: string
          id?: string
          is_active?: boolean
          temp_email_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_forwarding_temp_email_id_fkey"
            columns: ["temp_email_id"]
            isOneToOne: true
            referencedRelation: "temp_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_forwarding_temp_email_id_fkey"
            columns: ["temp_email_id"]
            isOneToOne: true
            referencedRelation: "temp_emails_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          temp_email_id: string | null
          user_id: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          temp_email_id?: string | null
          user_id?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          temp_email_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_temp_email_id_fkey"
            columns: ["temp_email_id"]
            isOneToOne: false
            referencedRelation: "temp_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_temp_email_id_fkey"
            columns: ["temp_email_id"]
            isOneToOne: false
            referencedRelation: "temp_emails_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_type: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          action_type: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          action_type?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      received_emails: {
        Row: {
          body: string | null
          encryption_key_id: string | null
          from_address: string
          html_body: string | null
          id: string
          is_encrypted: boolean | null
          is_read: boolean
          received_at: string
          subject: string | null
          temp_email_id: string
        }
        Insert: {
          body?: string | null
          encryption_key_id?: string | null
          from_address: string
          html_body?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean
          received_at?: string
          subject?: string | null
          temp_email_id: string
        }
        Update: {
          body?: string | null
          encryption_key_id?: string | null
          from_address?: string
          html_body?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean
          received_at?: string
          subject?: string | null
          temp_email_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "received_emails_temp_email_id_fkey"
            columns: ["temp_email_id"]
            isOneToOne: false
            referencedRelation: "temp_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_emails_temp_email_id_fkey"
            columns: ["temp_email_id"]
            isOneToOne: false
            referencedRelation: "temp_emails_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_emails: {
        Row: {
          id: string
          received_email_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          received_email_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          received_email_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_emails_received_email_id_fkey"
            columns: ["received_email_id"]
            isOneToOne: false
            referencedRelation: "received_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          ai_summaries_per_day: number
          can_forward_emails: boolean
          can_use_api: boolean
          can_use_custom_domains: boolean
          created_at: string
          email_expiry_hours: number
          features: Json
          id: string
          is_active: boolean
          max_temp_emails: number
          name: string
          price_monthly: number
          price_yearly: number
          priority_support: boolean
          updated_at: string
        }
        Insert: {
          ai_summaries_per_day?: number
          can_forward_emails?: boolean
          can_use_api?: boolean
          can_use_custom_domains?: boolean
          created_at?: string
          email_expiry_hours?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_temp_emails?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          priority_support?: boolean
          updated_at?: string
        }
        Update: {
          ai_summaries_per_day?: number
          can_forward_emails?: boolean
          can_use_api?: boolean
          can_use_custom_domains?: boolean
          created_at?: string
          email_expiry_hours?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_temp_emails?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          priority_support?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      temp_emails: {
        Row: {
          address: string
          created_at: string
          domain_id: string
          expires_at: string
          id: string
          is_active: boolean
          secret_token: string
          user_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          domain_id: string
          expires_at?: string
          id?: string
          is_active?: boolean
          secret_token?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          domain_id?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          secret_token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_emails_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          id: string
          is_enabled: boolean
          totp_secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          totp_secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          totp_secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_invoices: {
        Row: {
          amount_paid: number
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_pdf: string | null
          invoice_url: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_pdf?: string | null
          invoice_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_pdf?: string | null
          invoice_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_suspensions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lifted_at: string | null
          lifted_by: string | null
          reason: string | null
          suspended_at: string
          suspended_by: string
          suspended_until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string | null
          suspended_at?: string
          suspended_by: string
          suspended_until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string | null
          suspended_at?: string
          suspended_by?: string
          suspended_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          ai_summaries_used: number
          created_at: string
          date: string
          emails_forwarded: number
          emails_received: number
          id: string
          temp_emails_created: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summaries_used?: number
          created_at?: string
          date?: string
          emails_forwarded?: number
          emails_received?: number
          id?: string
          temp_emails_created?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summaries_used?: number
          created_at?: string
          date?: string
          emails_forwarded?: number
          emails_received?: number
          id?: string
          temp_emails_created?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      temp_emails_public: {
        Row: {
          address: string | null
          created_at: string | null
          domain_id: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          domain_id?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          domain_id?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "temp_emails_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_admin_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: boolean
      }
      admin_get_all_profiles: {
        Args: never
        Returns: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      bulk_delete_users: { Args: { user_ids: string[] }; Returns: number }
      check_rate_limit: {
        Args: {
          p_action_type: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      delete_user_as_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      find_user_by_email: {
        Args: { search_email: string }
        Returns: {
          found_display_name: string
          found_email: string
          found_role: string
          found_user_id: string
        }[]
      }
      generate_secret_token: { Args: never; Returns: string }
      get_admin_audit_logs: {
        Args: {
          p_action_filter?: string
          p_page?: number
          p_page_size?: number
        }
        Returns: {
          action: string
          admin_email: string
          admin_name: string
          created_at: string
          details: Json
          id: string
          record_id: string
          table_name: string
          total_count: number
        }[]
      }
      get_admin_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
          user_id: string
        }[]
      }
      get_all_profiles_for_admin: {
        Args: { p_page?: number; p_page_size?: number; p_search?: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
          total_count: number
          updated_at: string
          user_id: string
        }[]
      }
      get_suspended_users: {
        Args: never
        Returns: {
          display_name: string
          email: string
          id: string
          reason: string
          suspended_at: string
          suspended_by_email: string
          suspended_until: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ip_blocked: { Args: { p_ip_address: string }; Returns: boolean }
      is_user_suspended: { Args: { check_user_id: string }; Returns: boolean }
      log_admin_access: {
        Args: {
          p_action: string
          p_details?: Json
          p_record_id?: string
          p_table_name: string
        }
        Returns: string
      }
      remove_admin_role: { Args: { target_user_id: string }; Returns: boolean }
      suspend_user: {
        Args: {
          suspend_until?: string
          suspension_reason?: string
          target_user_id: string
        }
        Returns: boolean
      }
      unsuspend_user: { Args: { target_user_id: string }; Returns: boolean }
      verify_temp_email_token: {
        Args: { p_temp_email_id: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
