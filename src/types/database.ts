/**
 * Generated from the live database schema. Do not edit by hand.
 *
 * Regenerate after any migration; a stale copy here is worse than none,
 * because it type-checks against a schema that no longer exists.
 */
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          business_id: string
          created_at: string
          id: string
          kind: string
          payload: Json
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          at: string
          business_id: string
          id: number
          metadata: Json
          resource_id: string
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          at?: string
          business_id: string
          id?: number
          metadata?: Json
          resource_id: string
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          at?: string
          business_id?: string
          id?: number
          metadata?: Json
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_documents: {
        Row: {
          business_id: string
          folder: string | null
          id: string
          kind: string
          payload: Json
          status: string
          storage_key: string | null
          tax_year: number | null
          title: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          business_id: string
          folder?: string | null
          id?: string
          kind?: string
          payload?: Json
          status?: string
          storage_key?: string | null
          tax_year?: number | null
          title?: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          business_id?: string
          folder?: string | null
          id?: string
          kind?: string
          payload?: Json
          status?: string
          storage_key?: string | null
          tax_year?: number | null
          title?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          accounting_method: string
          address: Json
          contractor_count: number | null
          created_at: string
          created_by: string
          dba_name: string | null
          delivery_platforms: string[]
          email: string | null
          employee_count: number | null
          entity_type: string
          fiscal_year_end_month: number | null
          handles_cash: boolean
          has_ein: boolean
          id: string
          industry: string
          legal_name: string
          location_count: number
          merchant_processor: string | null
          payroll_provider: string | null
          phone: string | null
          prior_year_return_available: boolean | null
          sales_tax_registered: boolean | null
          started_year: number | null
          updated_at: string
        }
        Insert: {
          accounting_method?: string
          address?: Json
          contractor_count?: number | null
          created_at?: string
          created_by?: string
          dba_name?: string | null
          delivery_platforms?: string[]
          email?: string | null
          employee_count?: number | null
          entity_type?: string
          fiscal_year_end_month?: number | null
          handles_cash?: boolean
          has_ein?: boolean
          id?: string
          industry?: string
          legal_name: string
          location_count?: number
          merchant_processor?: string | null
          payroll_provider?: string | null
          phone?: string | null
          prior_year_return_available?: boolean | null
          sales_tax_registered?: boolean | null
          started_year?: number | null
          updated_at?: string
        }
        Update: {
          accounting_method?: string
          address?: Json
          contractor_count?: number | null
          created_at?: string
          created_by?: string
          dba_name?: string | null
          delivery_platforms?: string[]
          email?: string | null
          employee_count?: number | null
          entity_type?: string
          fiscal_year_end_month?: number | null
          handles_cash?: boolean
          has_ein?: boolean
          id?: string
          industry?: string
          legal_name?: string
          location_count?: number
          merchant_processor?: string | null
          payroll_provider?: string | null
          phone?: string | null
          prior_year_return_available?: boolean | null
          sales_tax_registered?: boolean | null
          started_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          business_id: string
          created_at: string
          failure_reason: string | null
          id: string
          institution_name: string
          kind: string
          last_successful_sync_at: string | null
          last_sync_at: string | null
          provider_ref: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          institution_name: string
          kind: string
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          provider_ref?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          institution_name?: string
          kind?: string
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          provider_ref?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_groups: {
        Row: {
          business_id: string
          category_key: string
          id: string
          payload: Json
          tax_year: number
          updated_at: string
        }
        Insert: {
          business_id: string
          category_key: string
          id?: string
          payload?: Json
          tax_year: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          category_key?: string
          id?: string
          payload?: Json
          tax_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deduction_groups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      export_packages: {
        Row: {
          business_id: string
          created_at: string
          format: string
          id: string
          payload: Json
          status: string
          tax_year: number
        }
        Insert: {
          business_id: string
          created_at?: string
          format: string
          id?: string
          payload?: Json
          status?: string
          tax_year: number
        }
        Update: {
          business_id?: string
          created_at?: string
          format?: string
          id?: string
          payload?: Json
          status?: string
          tax_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_packages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          active: boolean
          business_id: string
          connection_id: string | null
          created_at: string
          currency: string
          id: string
          masked_number: string
          name: string
          type: string
        }
        Insert: {
          active?: boolean
          business_id: string
          connection_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          masked_number?: string
          name: string
          type?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          connection_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          masked_number?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      localities: {
        Row: {
          city: string | null
          county: string | null
          filing_authorities: Json
          id: string
          label: string
          state: string
        }
        Insert: {
          city?: string | null
          county?: string | null
          filing_authorities?: Json
          id: string
          label: string
          state: string
        }
        Update: {
          city?: string | null
          county?: string | null
          filing_authorities?: Json
          id?: string
          label?: string
          state?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          grant_id: string | null
          id: string
          invited_by_user_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          grant_id?: string | null
          id?: string
          invited_by_user_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          grant_id?: string | null
          id?: string
          invited_by_user_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          locale: string
          mfa_enabled: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
          id: string
          locale?: string
          mfa_enabled?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          locale?: string
          mfa_enabled?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quarterly_estimates: {
        Row: {
          business_id: string
          id: string
          payload: Json
          tax_year: number
          updated_at: string
        }
        Insert: {
          business_id: string
          id?: string
          payload?: Json
          tax_year: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          id?: string
          payload?: Json
          tax_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_estimates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          business_id: string
          business_purpose: string | null
          duplicate_of_receipt_id: string | null
          extracted: Json | null
          id: string
          match: Json | null
          page_count: number
          status: string
          storage_key: string
          updated_at: string
          uploaded_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          business_id: string
          business_purpose?: string | null
          duplicate_of_receipt_id?: string | null
          extracted?: Json | null
          id?: string
          match?: Json | null
          page_count?: number
          status?: string
          storage_key: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          business_id?: string
          business_purpose?: string | null
          duplicate_of_receipt_id?: string | null
          extracted?: Json | null
          id?: string
          match?: Json | null
          page_count?: number
          status?: string
          storage_key?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_duplicate_of_receipt_id_fkey"
            columns: ["duplicate_of_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      sharing_grants: {
        Row: {
          business_id: string
          created_at: string
          expires_at: string
          folders: string[]
          id: string
          invitee_email: string | null
          invitee_user_id: string | null
          payload: Json
          revoked_at: string | null
          status: string
          tax_year: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          expires_at: string
          folders?: string[]
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          payload?: Json
          revoked_at?: string | null
          status?: string
          tax_year?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          expires_at?: string
          folders?: string[]
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          payload?: Json
          revoked_at?: string | null
          status?: string
          tax_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sharing_grants_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_identities: {
        Row: {
          business_id: string
          ein_token: string | null
          last_verified_at: string | null
          owner_ssn_token: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          ein_token?: string | null
          last_verified_at?: string | null
          owner_ssn_token?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          ein_token?: string | null
          last_verified_at?: string | null
          owner_ssn_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_identities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          audit_trail: Json
          business_id: string
          business_purpose: string | null
          classification: string
          confirmed: Json | null
          created_at: string
          currency: string
          description_raw: string
          flags: string[]
          id: string
          merchant_normalized: string | null
          merchant_raw: string
          notes: string | null
          posted_at: string
          receipt_id: string | null
          scope: string
          splits: Json
          status: string
          suggested: Json | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          audit_trail?: Json
          business_id: string
          business_purpose?: string | null
          classification?: string
          confirmed?: Json | null
          created_at?: string
          currency?: string
          description_raw?: string
          flags?: string[]
          id?: string
          merchant_normalized?: string | null
          merchant_raw?: string
          notes?: string | null
          posted_at: string
          receipt_id?: string | null
          scope?: string
          splits?: Json
          status?: string
          suggested?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          audit_trail?: Json
          business_id?: string
          business_purpose?: string | null
          classification?: string
          confirmed?: Json | null
          created_at?: string
          currency?: string
          description_raw?: string
          flags?: string[]
          id?: string
          merchant_normalized?: string | null
          merchant_raw?: string
          notes?: string | null
          posted_at?: string
          receipt_id?: string | null
          scope?: string
          splits?: Json
          status?: string
          suggested?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          business_type: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          language: string
          source: string | null
          zip_code: string | null
        }
        Insert: {
          business_type?: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          language?: string
          source?: string | null
          zip_code?: string | null
        }
        Update: {
          business_type?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          language?: string
          source?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_admin_business: { Args: { b: string }; Returns: boolean }
      can_write_business: { Args: { b: string }; Returns: boolean }
      create_business: {
        Args: {
          p_address?: Json
          p_dba_name?: string
          p_entity_type?: string
          p_industry?: string
          p_legal_name: string
          p_phone?: string
        }
        Returns: {
          accounting_method: string
          address: Json
          contractor_count: number | null
          created_at: string
          created_by: string
          dba_name: string | null
          delivery_platforms: string[]
          email: string | null
          employee_count: number | null
          entity_type: string
          fiscal_year_end_month: number | null
          handles_cash: boolean
          has_ein: boolean
          id: string
          industry: string
          legal_name: string
          location_count: number
          merchant_processor: string | null
          payroll_provider: string | null
          phone: string | null
          prior_year_return_available: boolean | null
          sales_tax_registered: boolean | null
          started_year: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_member_of: { Args: { b: string }; Returns: boolean }
      role_in_business: { Args: { b: string }; Returns: string }
      shares_business_with: { Args: { other: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
