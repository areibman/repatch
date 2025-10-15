/**
 * Typefully API integration
 * Reference: https://support.typefully.com/en/articles/8718287-typefully-api
 */

const TYPEFULLY_API_BASE = "https://api.typefully.com/v1";

export interface TypefullyDraft {
  content: string;
  threadify?: boolean;
  schedule_date?: string;
  share?: boolean;
}

export interface TypefullyDraftResponse {
  id: string;
  content: string;
  status: "draft" | "scheduled" | "published";
  created_at: string;
  updated_at: string;
}

export interface TypefullyMediaUploadResponse {
  url: string;
  media_id: string;
}

/**
 * Create a draft on Typefully
 */
export async function createTypefullyDraft(
  apiKey: string,
  draft: TypefullyDraft
): Promise<TypefullyDraftResponse> {
  const response = await fetch(`${TYPEFULLY_API_BASE}/drafts/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(draft),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Typefully API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Upload media to Typefully
 * Note: The API accepts a file upload via multipart/form-data
 */
export async function uploadTypefullyMedia(
  apiKey: string,
  fileBuffer: Buffer,
  filename: string
): Promise<TypefullyMediaUploadResponse> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "video/mp4" });
  formData.append("file", blob, filename);

  const response = await fetch(`${TYPEFULLY_API_BASE}/media/`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Typefully media upload error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get a draft by ID
 */
export async function getTypefullyDraft(
  apiKey: string,
  draftId: string
): Promise<TypefullyDraftResponse> {
  const response = await fetch(`${TYPEFULLY_API_BASE}/drafts/${draftId}/`, {
    headers: {
      "X-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Typefully API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Format patch note content into a Twitter thread format
 * Respects Twitter's 280 character limit per tweet
 */
export function formatPatchNoteAsThread(
  title: string,
  content: string,
  repoName: string,
  videoUrl?: string
): string {
  const lines: string[] = [];

  // First tweet: Title and intro
  lines.push(`🚀 ${title}\n\n📦 ${repoName}\n\n🧵 Thread below 👇`);

  // Parse markdown content into logical sections
  const sections = content.split("\n\n").filter((s) => s.trim());

  for (const section of sections) {
    // Skip empty sections
    if (!section.trim()) continue;

    // Handle headers
    if (section.startsWith("#")) {
      const headerText = section.replace(/^#+\s*/, "");
      lines.push(`\n${headerText}`);
      continue;
    }

    // Handle list items
    if (section.startsWith("- ") || section.startsWith("* ")) {
      const items = section.split("\n").filter((l) => l.trim());
      for (const item of items) {
        const cleanItem = item.replace(/^[-*]\s*/, "• ");
        if (cleanItem.length <= 280) {
          lines.push(cleanItem);
        } else {
          // Split long items
          const words = cleanItem.split(" ");
          let current = "• ";
          for (const word of words) {
            if ((current + word).length <= 280) {
              current += (current === "• " ? "" : " ") + word;
            } else {
              if (current !== "• ") lines.push(current);
              current = "  " + word;
            }
          }
          if (current.trim()) lines.push(current);
        }
      }
      continue;
    }

    // Handle regular paragraphs
    if (section.length <= 280) {
      lines.push(section);
    } else {
      // Split long paragraphs into multiple tweets
      const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];
      let current = "";

      for (const sentence of sentences) {
        if ((current + sentence).length <= 280) {
          current += sentence;
        } else {
          if (current) lines.push(current.trim());
          current = sentence;
        }
      }
      if (current.trim()) lines.push(current.trim());
    }
  }

  // Add video URL if available
  if (videoUrl) {
    lines.push(`\n🎥 Watch the video: ${videoUrl}`);
  }

  // Join with double newlines for thread format
  return lines.join("\n\n");
}
