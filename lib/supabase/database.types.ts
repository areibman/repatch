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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_templates_backup: {
        Row: {
          audience: string | null
          commit_prompt: string | null
          created_at: string | null
          description: string | null
          examples: Json | null
          id: string | null
          name: string | null
          overall_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          audience?: string | null
          commit_prompt?: string | null
          created_at?: string | null
          description?: string | null
          examples?: Json | null
          id?: string | null
          name?: string | null
          overall_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          audience?: string | null
          commit_prompt?: string | null
          created_at?: string | null
          description?: string | null
          examples?: Json | null
          id?: string | null
          name?: string | null
          overall_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          provider: Database["public"]["Enums"]["email_provider_type"]
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider: Database["public"]["Enums"]["email_provider_type"]
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: Database["public"]["Enums"]["email_provider_type"]
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_subscribers: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      github_configs: {
        Row: {
          access_token: string
          created_at: string
          id: string
          repo_name: string | null
          repo_owner: string | null
          repo_url: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          repo_name?: string | null
          repo_owner?: string | null
          repo_url: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          repo_name?: string | null
          repo_owner?: string | null
          repo_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      patch_notes: {
        Row: {
          ai_detailed_contexts: Json | null
          ai_overall_summary: string | null
          ai_summaries: Json | null
          ai_template_id: string | null
          changes: Json
          content: string | null
          contributors: string[]
          created_at: string
          filter_metadata: Json | null
          generated_at: string
          id: string
          processing_error: string | null
          processing_progress: number | null
          processing_stage: string | null
          processing_status:
            | Database["public"]["Enums"]["processing_status_type"]
            | null
          repo_branch: string | null
          repo_name: string
          repo_url: string
          time_period: Database["public"]["Enums"]["time_period_type"]
          title: string
          updated_at: string
          video_bucket_name: string | null
          video_data: Json | null
          video_render_id: string | null
          video_top_changes: Json | null
          video_url: string | null
        }
        Insert: {
          ai_detailed_contexts?: Json | null
          ai_overall_summary?: string | null
          ai_summaries?: Json | null
          ai_template_id?: string | null
          changes?: Json
          content?: string | null
          contributors?: string[]
          created_at?: string
          filter_metadata?: Json | null
          generated_at?: string
          id?: string
          processing_error?: string | null
          processing_progress?: number | null
          processing_stage?: string | null
          processing_status?:
            | Database["public"]["Enums"]["processing_status_type"]
            | null
          repo_branch?: string | null
          repo_name: string
          repo_url: string
          time_period: Database["public"]["Enums"]["time_period_type"]
          title: string
          updated_at?: string
          video_bucket_name?: string | null
          video_data?: Json | null
          video_render_id?: string | null
          video_top_changes?: Json | null
          video_url?: string | null
        }
        Update: {
          ai_detailed_contexts?: Json | null
          ai_overall_summary?: string | null
          ai_summaries?: Json | null
          ai_template_id?: string | null
          changes?: Json
          content?: string | null
          contributors?: string[]
          created_at?: string
          filter_metadata?: Json | null
          generated_at?: string
          id?: string
          processing_error?: string | null
          processing_progress?: number | null
          processing_stage?: string | null
          processing_status?:
            | Database["public"]["Enums"]["processing_status_type"]
            | null
          repo_branch?: string | null
          repo_name?: string
          repo_url?: string
          time_period?: Database["public"]["Enums"]["time_period_type"]
          title?: string
          updated_at?: string
          video_bucket_name?: string | null
          video_data?: Json | null
          video_render_id?: string | null
          video_top_changes?: Json | null
          video_url?: string | null
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
      email_provider_type: "resend" | "customerio"
      processing_status_type:
        | "pending"
        | "fetching_stats"
        | "analyzing_commits"
        | "generating_content"
        | "generating_video"
        | "completed"
        | "failed"
      time_period_type: "1day" | "1week" | "1month" | "custom" | "release"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      email_provider_type: ["resend", "customerio"],
      processing_status_type: [
        "pending",
        "fetching_stats",
        "analyzing_commits",
        "generating_content",
        "generating_video",
        "completed",
        "failed",
      ],
      time_period_type: ["1day", "1week", "1month", "custom", "release"],
    },
  },
} as const
