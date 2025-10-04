export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      patch_notes: {
        Row: {
          id: string
          repo_name: string
          repo_url: string
          time_period: '1day' | '1week' | '1month'
          title: string
          content: string
          changes: {
            added: number
            modified: number
            removed: number
          }
          contributors: string[]
          generated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          repo_name: string
          repo_url: string
          time_period: '1day' | '1week' | '1month'
          title: string
          content: string
          changes?: {
            added: number
            modified: number
            removed: number
          }
          contributors?: string[]
          generated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          repo_name?: string
          repo_url?: string
          time_period?: '1day' | '1week' | '1month'
          title?: string
          content?: string
          changes?: {
            added: number
            modified: number
            removed: number
          }
          contributors?: string[]
          generated_at?: string
          created_at?: string
          updated_at?: string
        }
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      time_period_type: '1day' | '1week' | '1month'
    }
  }
}

