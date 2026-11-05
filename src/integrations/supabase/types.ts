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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      negotiation_conversations: {
        Row: {
          created_at: string | null
          current_price: number
          final_price_reached: boolean
          guarantee_dropped: boolean
          id: string
          in_flight: boolean
          messages_used: number
          supplier_key: string
          team_id: string
          term_overrides: Json
          trap_offered: boolean
          trap_on_table: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_price: number
          final_price_reached?: boolean
          guarantee_dropped?: boolean
          id?: string
          in_flight?: boolean
          messages_used?: number
          supplier_key: string
          team_id: string
          term_overrides?: Json
          trap_offered?: boolean
          trap_on_table?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_price?: number
          final_price_reached?: boolean
          guarantee_dropped?: boolean
          id?: string
          in_flight?: boolean
          messages_used?: number
          supplier_key?: string
          team_id?: string
          term_overrides?: Json
          trap_offered?: boolean
          trap_on_table?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_conversations_supplier_key_fkey"
            columns: ["supplier_key"]
            isOneToOne: false
            referencedRelation: "negotiation_suppliers"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "negotiation_conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_deals: {
        Row: {
          accepted_at: string | null
          conditions: Json
          is_trap: boolean
          is_valid: boolean
          price: number
          supplier_key: string
          team_id: string
        }
        Insert: {
          accepted_at?: string | null
          conditions?: Json
          is_trap?: boolean
          is_valid?: boolean
          price: number
          supplier_key: string
          team_id: string
        }
        Update: {
          accepted_at?: string | null
          conditions?: Json
          is_trap?: boolean
          is_valid?: boolean
          price?: number
          supplier_key?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_deals_supplier_key_fkey"
            columns: ["supplier_key"]
            isOneToOne: false
            referencedRelation: "negotiation_suppliers"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "negotiation_deals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          meta: Json | null
          price_after: number | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          price_after?: number | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          price_after?: number | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "negotiation_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_settings: {
        Row: {
          id: boolean
          is_open: boolean
          llm_model: string
          llm_provider: string
          max_messages: number
          rules_prompt: string
          updated_at: string | null
        }
        Insert: {
          id?: boolean
          is_open?: boolean
          llm_model?: string
          llm_provider?: string
          max_messages?: number
          rules_prompt?: string
          updated_at?: string | null
        }
        Update: {
          id?: boolean
          is_open?: boolean
          llm_model?: string
          llm_provider?: string
          max_messages?: number
          rules_prompt?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      negotiation_suppliers: {
        Row: {
          alt_min_condition: string | null
          alt_min_price: number | null
          concession_weak_spot_pct: number
          created_at: string | null
          enabled: boolean
          fixed_facts: string
          initial_price: number
          key: string
          materials: Json
          min_price: number
          name: string
          offer_terms: Json
          persona: string
          proposal_documents: string
          proposal_intro: string
          proposal_specs: Json
          qualified: boolean
          region: string
          site_content: Json
          sort_order: number
          trap: Json | null
          updated_at: string | null
          weak_spots: string[]
        }
        Insert: {
          alt_min_condition?: string | null
          alt_min_price?: number | null
          concession_weak_spot_pct?: number
          created_at?: string | null
          enabled?: boolean
          fixed_facts?: string
          initial_price: number
          key: string
          materials?: Json
          min_price: number
          name: string
          offer_terms?: Json
          persona?: string
          proposal_documents?: string
          proposal_intro?: string
          proposal_specs?: Json
          qualified?: boolean
          region?: string
          site_content?: Json
          sort_order?: number
          trap?: Json | null
          updated_at?: string | null
          weak_spots?: string[]
        }
        Update: {
          alt_min_condition?: string | null
          alt_min_price?: number | null
          concession_weak_spot_pct?: number
          created_at?: string | null
          enabled?: boolean
          fixed_facts?: string
          initial_price?: number
          key?: string
          materials?: Json
          min_price?: number
          name?: string
          offer_terms?: Json
          persona?: string
          proposal_documents?: string
          proposal_intro?: string
          proposal_specs?: Json
          qualified?: boolean
          region?: string
          site_content?: Json
          sort_order?: number
          trap?: Json | null
          updated_at?: string | null
          weak_spots?: string[]
        }
        Relationships: []
      }
      phases: {
        Row: {
          background: string | null
          budget: number | null
          cheat_sheet: string
          duration_minutes: number | null
          end_time: string | null
          evaluation: string
          id: string
          impact_type: string[] | null
          learnings_ai_arsenal: string
          learnings_project_management: string
          learnings_visible: boolean
          materials: string | null
          name: string
          order: number
          output: string | null
          parallel_with: string
          parallel_with_previous: boolean
          start_time: string | null
          status: string | null
          task: string | null
          tools: string[] | null
        }
        Insert: {
          background?: string | null
          budget?: number | null
          cheat_sheet?: string
          duration_minutes?: number | null
          end_time?: string | null
          evaluation?: string
          id: string
          impact_type?: string[] | null
          learnings_ai_arsenal?: string
          learnings_project_management?: string
          learnings_visible?: boolean
          materials?: string | null
          name: string
          order: number
          output?: string | null
          parallel_with?: string
          parallel_with_previous?: boolean
          start_time?: string | null
          status?: string | null
          task?: string | null
          tools?: string[] | null
        }
        Update: {
          background?: string | null
          budget?: number | null
          cheat_sheet?: string
          duration_minutes?: number | null
          end_time?: string | null
          evaluation?: string
          id?: string
          impact_type?: string[] | null
          learnings_ai_arsenal?: string
          learnings_project_management?: string
          learnings_visible?: boolean
          materials?: string | null
          name?: string
          order?: number
          output?: string | null
          parallel_with?: string
          parallel_with_previous?: boolean
          start_time?: string | null
          status?: string | null
          task?: string | null
          tools?: string[] | null
        }
        Relationships: []
      }
      ranking_entries: {
        Row: {
          amount: number
          created_at: string
          id: string
          phase_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          phase_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          phase_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_entries_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_settings: {
        Row: {
          id: boolean
          starting_budget: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          starting_budget?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          starting_budget?: number
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          content_rtf: string | null
          display_order: number | null
          enabled: boolean | null
          id: string
          page_key: string
          parameters: Json | null
        }
        Insert: {
          content_rtf?: string | null
          display_order?: number | null
          enabled?: boolean | null
          id: string
          page_key: string
          parameters?: Json | null
        }
        Update: {
          content_rtf?: string | null
          display_order?: number | null
          enabled?: boolean | null
          id?: string
          page_key?: string
          parameters?: Json | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          budget: number | null
          created_at: string | null
          drive_share_url: string | null
          expected_revenue: number | null
          id: string
          intro_video_url: string
          last_recalculated: string | null
          logo_url: string | null
          members: Json
          name: string
          pm_name: string
          rank: number | null
          status: string | null
          time_bonus: number | null
          time_weeks: number | null
          token: string
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          created_at?: string | null
          drive_share_url?: string | null
          expected_revenue?: number | null
          id: string
          intro_video_url?: string
          last_recalculated?: string | null
          logo_url?: string | null
          members?: Json
          name: string
          pm_name?: string
          rank?: number | null
          status?: string | null
          time_bonus?: number | null
          time_weeks?: number | null
          token: string
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          created_at?: string | null
          drive_share_url?: string | null
          expected_revenue?: number | null
          id?: string
          intro_video_url?: string
          last_recalculated?: string | null
          logo_url?: string | null
          members?: Json
          name?: string
          pm_name?: string
          rank?: number | null
          status?: string | null
          time_bonus?: number | null
          time_weeks?: number | null
          token?: string
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tool_categories: {
        Row: {
          description: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          description?: string
          display_order?: number
          id: string
          name: string
        }
        Update: {
          description?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      tools: {
        Row: {
          category: string
          description: string | null
          display_order: number | null
          id: string
          link_url: string | null
          logo_url: string | null
          tool_name: string
          visible: boolean | null
        }
        Insert: {
          category?: string
          description?: string | null
          display_order?: number | null
          id: string
          link_url?: string | null
          logo_url?: string | null
          tool_name: string
          visible?: boolean | null
        }
        Update: {
          category?: string
          description?: string | null
          display_order?: number | null
          id?: string
          link_url?: string | null
          logo_url?: string | null
          tool_name?: string
          visible?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
