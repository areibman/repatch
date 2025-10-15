/**
 * Typefully API client for creating and managing Twitter threads
 * API Documentation: https://support.typefully.com/en/articles/8718287-typefully-api
 */

import { Database } from "./supabase/database.types";

type PatchNote = Database["public"]["Tables"]["patch_notes"]["Row"];
type TypefullyJob = Database["public"]["Tables"]["typefully_jobs"]["Row"];

interface TypefullyDraftOptions {
  content: string[];
  schedule?: string; // ISO 8601 datetime string
  threadify?: boolean;
  autoRetweet?: boolean;
  media?: string[]; // Array of media URLs
}

interface TypefullyDraftResponse {
  id: string;
  status: "draft" | "scheduled" | "published";
  url: string;
  created_at: string;
  scheduled_for?: string;
  published_at?: string;
}

interface TypefullyProfile {
  id: string;
  username: string;
  name: string;
  avatar_url: string;
}

export class TypefullyClient {
  private apiKey: string;
  private baseUrl = "https://api.typefully.com";
  private headers: HeadersInit;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get the authenticated user's Twitter profiles
   */
  async getProfiles(): Promise<TypefullyProfile[]> {
    const response = await fetch(`${this.baseUrl}/profiles`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch profiles: ${error}`);
    }

    return response.json();
  }

  /**
   * Create a draft thread on Typefully
   */
  async createDraft(options: TypefullyDraftOptions): Promise<TypefullyDraftResponse> {
    const response = await fetch(`${this.baseUrl}/drafts`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        content: options.content,
        schedule: options.schedule,
        threadify: options.threadify !== false, // Default to true
        auto_retweet: options.autoRetweet,
        media: options.media,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create draft: ${error}`);
    }

    return response.json();
  }

  /**
   * Get a specific draft by ID
   */
  async getDraft(draftId: string): Promise<TypefullyDraftResponse> {
    const response = await fetch(`${this.baseUrl}/drafts/${draftId}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch draft: ${error}`);
    }

    return response.json();
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/drafts/${draftId}`, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete draft: ${error}`);
    }
  }
}

/**
 * Convert patch note to Twitter thread content
 * Splits long content into tweet-sized chunks
 */
export function patchNoteToThread(patchNote: PatchNote): string[] {
  const MAX_TWEET_LENGTH = 280;
  const thread: string[] = [];
  
  // First tweet: Title and high-level summary
  const firstTweet = `🚀 ${patchNote.title}\n\n` +
    `📊 ${patchNote.changes.added} lines added, ${patchNote.changes.removed} removed\n` +
    `👥 ${patchNote.contributors.length} contributors\n` +
    `🔗 ${patchNote.repo_name}`;
  
  thread.push(firstTweet.substring(0, MAX_TWEET_LENGTH));
  
  // Parse the main content and split into tweets
  const sections = patchNote.content.split(/\n#{1,2}\s+/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Clean up markdown formatting for Twitter
    let cleanedSection = section
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1") // Remove italic
      .replace(/`(.*?)`/g, "$1") // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
      .replace(/^[-*]\s+/gm, "• ") // Convert list items
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
      .trim();
    
    // Split long sections into multiple tweets
    if (cleanedSection.length <= MAX_TWEET_LENGTH) {
      thread.push(cleanedSection);
    } else {
      // Split at sentence boundaries when possible
      const sentences = cleanedSection.match(/[^.!?]+[.!?]+/g) || [cleanedSection];
      let currentTweet = "";
      
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        
        if (currentTweet.length + trimmedSentence.length + 1 <= MAX_TWEET_LENGTH - 10) {
          // Leave room for thread numbering
          currentTweet += (currentTweet ? " " : "") + trimmedSentence;
        } else {
          if (currentTweet) {
            thread.push(currentTweet);
          }
          currentTweet = trimmedSentence.substring(0, MAX_TWEET_LENGTH - 10);
        }
      }
      
      if (currentTweet) {
        thread.push(currentTweet);
      }
    }
  }
  
  // Add contributors in the last tweet if space allows
  if (patchNote.contributors.length > 0) {
    const contributorsText = `\n\nThanks to: ${patchNote.contributors.slice(0, 3).join(", ")}` +
      (patchNote.contributors.length > 3 ? ` and ${patchNote.contributors.length - 3} more` : "");
    
    if (thread[thread.length - 1].length + contributorsText.length <= MAX_TWEET_LENGTH) {
      thread[thread.length - 1] += contributorsText;
    } else {
      thread.push(`Thanks to: ${patchNote.contributors.join(", ")}`.substring(0, MAX_TWEET_LENGTH));
    }
  }
  
  // Add thread numbering
  const totalTweets = thread.length;
  return thread.map((tweet, index) => {
    if (totalTweets > 1) {
      return `[${index + 1}/${totalTweets}] ${tweet}`.substring(0, MAX_TWEET_LENGTH);
    }
    return tweet;
  });
}

/**
 * Format a patch note summary for Twitter with proper emoji and formatting
 */
export function formatPatchNoteSummary(patchNote: PatchNote): string {
  // Extract key highlights from AI summary if available
  let highlights = "";
  if (patchNote.ai_overall_summary) {
    // Take first 2 sentences or 200 chars
    const sentences = patchNote.ai_overall_summary.match(/[^.!?]+[.!?]+/g) || [];
    highlights = sentences.slice(0, 2).join(" ").substring(0, 200);
  } else {
    // Fall back to extracting from content
    const contentPreview = patchNote.content
      .replace(/#{1,6}\s+/g, "")
      .replace(/\n+/g, " ")
      .substring(0, 200);
    highlights = contentPreview;
  }
  
  return highlights.trim();
}