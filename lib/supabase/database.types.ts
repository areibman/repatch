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
          id: string
          name: string
          description: string | null
          audience: string
          commit_prompt: string
          overall_prompt: string
          examples: Json
          content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          audience?: string
          commit_prompt?: string
          overall_prompt?: string
          examples?: Json
          content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          audience?: string
          commit_prompt?: string
          overall_prompt?: string
          examples?: Json
          content?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_subscribers: {
        Row: {
          id: string
          email: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      github_configs: {
        Row: {
          id: string
          repo_url: string
          repo_owner: string | null
          repo_name: string | null
          access_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          repo_url: string
          repo_owner?: string | null
          repo_name?: string | null
          access_token: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          repo_url?: string
          repo_owner?: string | null
          repo_name?: string | null
          access_token?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      patch_notes: {
        Row: {
          id: string
          repo_name: string
          repo_url: string
          time_period: Database["public"]["Enums"]["time_period_type"]
          title: string
          content: string
          changes: Json
          contributors: string[]
          generated_at: string
          created_at: string
          updated_at: string
          video_data: Json | null
          ai_summaries: Json
          ai_overall_summary: string | null
          video_url: string | null
          filter_metadata: Json | null
          ai_template_id: string | null
          repo_branch: string
          ai_detailed_contexts: Json | null
          video_top_changes: Json | null
        }
        Insert: {
          id?: string
          repo_name: string
          repo_url: string
          time_period: Database["public"]["Enums"]["time_period_type"]
          title: string
          content: string
          changes?: Json
          contributors?: string[]
          generated_at?: string
          created_at?: string
          updated_at?: string
          video_data?: Json | null
          ai_summaries?: Json
          ai_overall_summary?: string | null
          video_url?: string | null
          filter_metadata?: Json | null
          ai_template_id?: string | null
          repo_branch?: string
          ai_detailed_contexts?: Json | null
          video_top_changes?: Json | null
        }
        Update: {
          id?: string
          repo_name?: string
          repo_url?: string
          time_period?: Database["public"]["Enums"]["time_period_type"]
          title?: string
          content?: string
          changes?: Json
          contributors?: string[]
          generated_at?: string
          created_at?: string
          updated_at?: string
          video_data?: Json | null
          ai_summaries?: Json
          ai_overall_summary?: string | null
          video_url?: string | null
          filter_metadata?: Json | null
          ai_template_id?: string | null
          repo_branch?: string
          ai_detailed_contexts?: Json | null
          video_top_changes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patch_notes_ai_template_id_fkey"
            columns: ["ai_template_id"]
            isOneToOne: false
            referencedRelation: "ai_templates"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      time_period_type: "1day" | "1week" | "1month" | "custom" | "release"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
      PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
      PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never

