export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
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
          video_url: string | null;
          video_data: Json | null;
          repo_branch: string | null;
          ai_summaries: Json | null;
          ai_overall_summary: string | null;
          ai_detailed_contexts: Json | null;
          ai_template_id: string | null;
          filter_metadata: Json | null;
          video_top_changes: Json | null;
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
          video_url?: string | null;
          video_data?: Json | null;
          repo_branch?: string | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          ai_detailed_contexts?: Json | null;
          ai_template_id?: string | null;
          filter_metadata?: Json | null;
          video_top_changes?: Json | null;
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
          video_url?: string | null;
          video_data?: Json | null;
          repo_branch?: string | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          ai_detailed_contexts?: Json | null;
          ai_template_id?: string | null;
          filter_metadata?: Json | null;
          video_top_changes?: Json | null;
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
      email_integrations: {
        Row: {
          id: string;
          provider: "resend" | "customer_io";
          display_name: string | null;
          from_email: string | null;
          api_key: string | null;
          audience_id: string | null;
          site_id: string | null;
          track_api_key: string | null;
          transactional_message_id: string | null;
          metadata: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: "resend" | "customer_io";
          display_name?: string | null;
          from_email?: string | null;
          api_key?: string | null;
          audience_id?: string | null;
          site_id?: string | null;
          track_api_key?: string | null;
          transactional_message_id?: string | null;
          metadata?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: "resend" | "customer_io";
          display_name?: string | null;
          from_email?: string | null;
          api_key?: string | null;
          audience_id?: string | null;
          site_id?: string | null;
          track_api_key?: string | null;
          transactional_message_id?: string | null;
          metadata?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
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
    };
    Views: {};
    Functions: {};
    Enums: {
      time_period_type: "1day" | "1week" | "1month";
    };
  };
}
