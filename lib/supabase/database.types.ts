export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export type TimePeriod =
  | "1day"
  | "1week"
  | "1month"
  | "custom"
  | "release";

export interface Database {
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
      };
      email_integrations: {
        Row: {
          id: string;
          provider: string;
          config: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
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
      };
      patch_notes: {
        Row: {
          id: string;
          repo_name: string;
          repo_url: string;
          repo_branch: string | null;
          time_period: TimePeriod;
          title: string;
          content: string;
          changes: Json;
          contributors: string[];
          generated_at: string;
          created_at: string;
          updated_at: string;
          video_url: string | null;
          video_data: Json | null;
          video_top_changes: Json | null;
          filter_metadata: Json | null;
          ai_summaries: Json | null;
          ai_overall_summary: string | null;
          ai_detailed_contexts: Json | null;
          ai_template_id: string | null;
        };
        Insert: {
          id?: string;
          repo_name: string;
          repo_url: string;
          repo_branch?: string | null;
          time_period: TimePeriod;
          title: string;
          content: string;
          changes?: Json;
          contributors?: string[];
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
          video_url?: string | null;
          video_data?: Json | null;
          video_top_changes?: Json | null;
          filter_metadata?: Json | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          ai_detailed_contexts?: Json | null;
          ai_template_id?: string | null;
        };
        Update: {
          id?: string;
          repo_name?: string;
          repo_url?: string;
          repo_branch?: string | null;
          time_period?: TimePeriod;
          title?: string;
          content?: string;
          changes?: Json;
          contributors?: string[];
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
          video_url?: string | null;
          video_data?: Json | null;
          video_top_changes?: Json | null;
          filter_metadata?: Json | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          ai_detailed_contexts?: Json | null;
          ai_template_id?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      time_period_type: TimePeriod;
    };
  };
}
