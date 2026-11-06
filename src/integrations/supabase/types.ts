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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ads: {
        Row: {
          active: boolean
          adsense_slot: string | null
          alt_text: string | null
          sponsor: string | null
          editions: string[]
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          kind: string
          link_url: string | null
          placement: string
          priority: number
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          adsense_slot?: string | null
          alt_text?: string | null
          sponsor?: string | null
          editions?: string[]
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          link_url?: string | null
          placement?: string
          priority?: number
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          adsense_slot?: string | null
          alt_text?: string | null
          sponsor?: string | null
          editions?: string[]
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          link_url?: string | null
          placement?: string
          priority?: number
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      ai_trail_items: {
        Row: {
          id: string
          research_id: string | null
          query_key: string
          event_date: string
          date_precision: string
          title: string
          summary: string
          url: string
          publisher: string
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          research_id?: string | null
          query_key: string
          event_date: string
          date_precision?: string
          title: string
          summary?: string
          url: string
          publisher?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          research_id?: string | null
          query_key?: string
          event_date?: string
          date_precision?: string
          title?: string
          summary?: string
          url?: string
          publisher?: string
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      aspirant_entries: {
        Row: {
          affiliation: string | null
          candidate_statement: Json
          origin: string
          created_at: string
          evidence_state: string
          pillars: Json
          reviewed_at: string | null
          status_note: string
          gaps: string[]
          id: string
          name: string
          office: string
          overview: string
          priorities: string[]
          published: boolean
          region: string | null
          slug: string
          sources: Json
          status: string
          updated_at: string
        }
        Insert: {
          affiliation?: string | null
          candidate_statement?: Json
          origin?: string
          created_at?: string
          evidence_state?: string
          pillars?: Json
          reviewed_at?: string | null
          status_note?: string
          gaps?: string[]
          id?: string
          name: string
          office?: string
          overview?: string
          priorities?: string[]
          published?: boolean
          region?: string | null
          slug: string
          sources?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          affiliation?: string | null
          candidate_statement?: Json
          origin?: string
          created_at?: string
          evidence_state?: string
          pillars?: Json
          reviewed_at?: string | null
          status_note?: string
          gaps?: string[]
          id?: string
          name?: string
          office?: string
          overview?: string
          priorities?: string[]
          published?: boolean
          region?: string | null
          slug?: string
          sources?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      aspirant_submissions: {
        Row: {
          id: string
          status: string
          name: string
          office: string
          region: string | null
          affiliation: string | null
          contact_name: string
          contact_role: string | null
          contact_email: string
          contact_phone: string | null
          overview: string
          priorities: string[]
          pledges: string
          costing: string
          delivery: string
          track_record: string
          sources: Json
          review_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          entry_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          status?: string
          name: string
          office: string
          region?: string | null
          affiliation?: string | null
          contact_name: string
          contact_role?: string | null
          contact_email: string
          contact_phone?: string | null
          overview: string
          priorities?: string[]
          pledges?: string
          costing?: string
          delivery?: string
          track_record?: string
          sources?: Json
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          entry_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          status?: string
          name?: string
          office?: string
          region?: string | null
          affiliation?: string | null
          contact_name?: string
          contact_role?: string | null
          contact_email?: string
          contact_phone?: string | null
          overview?: string
          priorities?: string[]
          pledges?: string
          costing?: string
          delivery?: string
          track_record?: string
          sources?: Json
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          entry_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      news_archive: {
        Row: {
          id: number
          link: string
          title: string
          summary: string
          source: string
          platform: string
          category: string
          edition: string
          published_at: string
          first_seen_at: string
        }
        Insert: {
          id?: number
          link: string
          title: string
          summary?: string
          source?: string
          platform?: string
          category?: string
          edition?: string
          published_at: string
          first_seen_at?: string
        }
        Update: {
          id?: number
          link?: string
          title?: string
          summary?: string
          source?: string
          platform?: string
          category?: string
          edition?: string
          published_at?: string
          first_seen_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: number
          path: string
          referrer: string | null
          session_id: string
          visitor_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: never
          path: string
          referrer?: string | null
          session_id: string
          visitor_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: never
          path?: string
          referrer?: string | null
          session_id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      pronunciations: {
        Row: {
          word: string
          spoken: string
          note: string
          created_at: string
        }
        Insert: {
          word: string
          spoken: string
          note?: string
          created_at?: string
        }
        Update: {
          word?: string
          spoken?: string
          note?: string
          created_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: string | null
          id: number
          severity: string
          type: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          severity?: string
          type: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          severity?: string
          type?: string
        }
        Relationships: []
      }
      site_events: {
        Row: {
          created_at: string
          id: number
          path: string | null
          target: string | null
          type: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          path?: string | null
          target?: string | null
          type: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: never
          path?: string | null
          target?: string | null
          type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      trails: {
        Row: {
          id: string
          slug: string
          title: string
          description: string
          query: string
          since: string | null
          published: boolean
          edition: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description?: string
          query: string
          since?: string | null
          published?: boolean
          edition?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string
          query?: string
          since?: string | null
          published?: boolean
          edition?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trail_events: {
        Row: {
          id: string
          trail_id: string
          event_date: string
          title: string
          summary: string
          url: string | null
          publisher: string
          created_at: string
        }
        Insert: {
          id?: string
          trail_id: string
          event_date: string
          title: string
          summary?: string
          url?: string | null
          publisher?: string
          created_at?: string
        }
        Update: {
          id?: string
          trail_id?: string
          event_date?: string
          title?: string
          summary?: string
          url?: string | null
          publisher?: string
          created_at?: string
        }
        Relationships: []
      }
      staff_regions: {
        Row: { user_id: string; edition: string }
        Insert: { user_id: string; edition: string }
        Update: { user_id?: string; edition?: string }
        Relationships: []
      }
      edition_stopwords: {
        Row: { edition: string; word: string }
        Insert: { edition: string; word: string }
        Update: { edition?: string; word?: string }
        Relationships: []
      }
      trend_stopwords: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
      trail_research: {
        Row: {
          id: string
          query_key: string
          query: string
          status: string
          origin: string
          items_found: number
          searches: number
          input_tokens: number | null
          output_tokens: number | null
          error: string | null
          created_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          query_key: string
          query: string
          status?: string
          origin?: string
          items_found?: number
          searches?: number
          input_tokens?: number | null
          output_tokens?: number | null
          error?: string | null
          created_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          query_key?: string
          query?: string
          status?: string
          origin?: string
          items_found?: number
          searches?: number
          input_tokens?: number | null
          output_tokens?: number | null
          error?: string | null
          created_at?: string
          finished_at?: string | null
        }
        Relationships: []
      }
      social_trends: {
        Row: {
          id: string
          platform: string
          topic: string
          note: string
          url: string | null
          created_at: string
          expires_at: string
          created_by: string | null
          edition: string
        }
        Insert: {
          id?: string
          platform: string
          topic: string
          note?: string
          url?: string | null
          created_at?: string
          expires_at?: string
          created_by?: string | null
          edition?: string
        }
        Update: {
          id?: string
          platform?: string
          topic?: string
          note?: string
          url?: string | null
          created_at?: string
          expires_at?: string
          created_by?: string | null
          edition?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      trending_terms: { Args: { _days: number; _limit?: number; _edition?: string | null }; Returns: { term: string; stories: number; sources: number; prev_stories: number }[] }
      trending_history: { Args: { _unit: string; _periods: number; _offset?: number; _per?: number; _edition?: string | null; _tz?: string }; Returns: { period_start: string; term: string | null; stories: number | null; sources: number | null; rank: number | null }[] }
      term_series: { Args: { _terms: string[]; _days: number; _edition?: string | null }; Returns: { term: string; bucket: string; stories: number }[] }
      trail_volume: { Args: { _query: string; _since: string | null }; Returns: { month: string; stories: number; sources: number }[] }
      trail_stories: { Args: { _query: string; _since: string | null; _per_month?: number; _max?: number }; Returns: { id: number; title: string; source: string; link: string; published_at: string; summary: string; category: string; platform: string; edition: string }[] }
      trail_related: { Args: { _query: string; _since: string | null; _limit?: number }; Returns: { term: string; stories: number }[] }
      trail_count_since: { Args: { _query: string; _ts: string }; Returns: number }
      purge_old_records: { Args: Record<PropertyKey, never>; Returns: Json }
      list_staff_regions: { Args: Record<PropertyKey, never>; Returns: { user_id: string; edition: string }[] }
      set_staff_regions: { Args: { _user: string; _editions: string[] }; Returns: boolean }
      list_team: { Args: Record<PropertyKey, never>; Returns: { user_id: string; email: string; role: Database["public"]["Enums"]["app_role"] }[] }
      grant_role_by_email: { Args: { _email: string; _role: Database["public"]["Enums"]["app_role"] }; Returns: boolean }
      revoke_role: { Args: { _user: string; _role: Database["public"]["Enums"]["app_role"] }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "moderator"
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
    Enums: {
      app_role: ["admin", "editor", "moderator"],
    },
  },
} as const
