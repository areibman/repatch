export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          audience: string;
          commit_prompt: string;
          overall_prompt: string;
          examples: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          audience?: string;
          commit_prompt: string;
          overall_prompt: string;
          examples?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          audience?: string;
          commit_prompt?: string;
          overall_prompt?: string;
          examples?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_integrations: {
        Row: {
          id: string;
          provider: string;
          is_active: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          is_active?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          is_active?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_subscribers: {
        Row: {
          id: string;
          email: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      github_configs: {
        Row: {
          id: string;
          repo_url: string;
          repo_owner: string | null;
          repo_name: string | null;
          access_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          repo_url: string;
          repo_owner?: string | null;
          repo_name?: string | null;
          access_token: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          repo_url?: string;
          repo_owner?: string | null;
          repo_name?: string | null;
          access_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patch_notes: {
        Row: {
          id: string;
          repo_name: string;
          repo_url: string;
          time_period: Database["public"]["Enums"]["time_period_type"];
          title: string;
          content: string;
          changes: Json;
          contributors: string[];
          generated_at: string;
          created_at: string;
          updated_at: string;
          video_data: Json | null;
          video_url: string | null;
          ai_summaries: Json | null;
          ai_overall_summary: string | null;
          filter_metadata: Json | null;
          ai_detailed_contexts: Json | null;
          video_top_changes: Json | null;
          ai_template_id: string | null;
          repo_branch: string | null;
        };
        Insert: {
          id?: string;
          repo_name: string;
          repo_url: string;
          time_period: Database["public"]["Enums"]["time_period_type"];
          title: string;
          content: string;
          changes?: Json;
          contributors?: string[];
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
          video_data?: Json | null;
          video_url?: string | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          filter_metadata?: Json | null;
          ai_detailed_contexts?: Json | null;
          video_top_changes?: Json | null;
          ai_template_id?: string | null;
          repo_branch?: string | null;
        };
        Update: {
          id?: string;
          repo_name?: string;
          repo_url?: string;
          time_period?: Database["public"]["Enums"]["time_period_type"];
          title?: string;
          content?: string;
          changes?: Json;
          contributors?: string[];
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
          video_data?: Json | null;
          video_url?: string | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          filter_metadata?: Json | null;
          ai_detailed_contexts?: Json | null;
          video_top_changes?: Json | null;
          ai_template_id?: string | null;
          repo_branch?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patch_notes_ai_template_id_fkey";
            columns: ["ai_template_id"];
            isOneToOne: false;
            referencedRelation: "ai_templates";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      time_period_type: "1day" | "1week" | "1month" | "custom" | "release";
    };
    CompositeTypes: {};
  };
};
