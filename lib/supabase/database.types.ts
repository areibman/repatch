export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_templates: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          name?: string
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
          contributors: string[] | null
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
          contributors?: string[] | null
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
          contributors?: string[] | null
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
        Relationships: [
          {
            foreignKeyName: "patch_notes_ai_template_id_fkey"
            columns: ["ai_template_id"]
            isOneToOne: false
            referencedRelation: "ai_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_tokens: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          hashed_token: string
          id: string
          last_used_at: string | null
          metadata: Json
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          hashed_token: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          name: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          hashed_token?: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_api_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_values: Json | null
          previous_values: Json | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_values?: Json | null
          previous_values?: Json | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_values?: Json | null
          previous_values?: Json | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          email_confirmed_at: string | null
          full_name: string | null
          last_sign_in_at: string | null
          metadata: Json
          role: Database["public"]["Enums"]["user_role_type"]
          status: Database["public"]["Enums"]["user_status_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string | null
          last_sign_in_at?: string | null
          metadata?: Json
          role?: Database["public"]["Enums"]["user_role_type"]
          status?: Database["public"]["Enums"]["user_status_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string | null
          last_sign_in_at?: string | null
          metadata?: Json
          role?: Database["public"]["Enums"]["user_role_type"]
          status?: Database["public"]["Enums"]["user_status_type"]
          updated_at?: string
          user_id?: string
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
      processing_status_type:
        | "pending"
        | "fetching_stats"
        | "analyzing_commits"
        | "generating_content"
        | "generating_video"
        | "completed"
        | "failed"
      time_period_type: "1day" | "1week" | "1month" | "custom" | "release"
      user_role_type: "admin" | "manager" | "editor" | "viewer" | "service"
      user_status_type: "invited" | "active" | "suspended" | "deactivated"
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
      user_role_type: ["admin", "manager", "editor", "viewer", "service"],
      user_status_type: ["invited", "active", "suspended", "deactivated"],
    },
  },
} as const

