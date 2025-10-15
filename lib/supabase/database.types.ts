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
          time_period: "1day" | "1week" | "1month";
          title: string;
          content: string;
          changes: {
            added: number;
            modified: number;
            removed: number;
          };
          contributors: string[];
          video_data: Json | null;
          video_url: string | null;
          ai_summaries: Json | null;
          ai_overall_summary: string | null;
          template_id: string | null;
          branch: string | null;
          generated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          repo_name: string;
          repo_url: string;
          time_period: "1day" | "1week" | "1month";
          title: string;
          content: string;
          changes?: {
            added: number;
            modified: number;
            removed: number;
          };
          contributors?: string[];
          video_data?: Json | null;
          video_url?: string | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          template_id?: string | null;
          branch?: string | null;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          repo_name?: string;
          repo_url?: string;
          time_period?: "1day" | "1week" | "1month";
          title?: string;
          content?: string;
          changes?: {
            added: number;
            modified: number;
            removed: number;
          };
          contributors?: string[];
          video_data?: Json | null;
          video_url?: string | null;
          ai_summaries?: Json | null;
          ai_overall_summary?: string | null;
          template_id?: string | null;
          branch?: string | null;
          generated_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          audience: "technical" | "non-technical" | "balanced";
          commit_prompt: string;
          overall_prompt: string;
          example_input: string | null;
          example_output: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          audience?: "technical" | "non-technical" | "balanced";
          commit_prompt: string;
          overall_prompt: string;
          example_input?: string | null;
          example_output?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          audience?: "technical" | "non-technical" | "balanced";
          commit_prompt?: string;
          overall_prompt?: string;
          example_input?: string | null;
          example_output?: string | null;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      time_period_type: "1day" | "1week" | "1month";
    };
  };
}
