import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { marked } from "marked";
import { Database } from "@/lib/supabase/database.types";
import { formatFilterSummary } from "@/lib/filter-utils";
import {
  getActiveProviderWithSubscribers,
  getActiveIntegration,
  instantiateProvider,
} from "@/lib/email/integrations";

import type { EmailProviderId } from "@/lib/email/types";

type PatchNote = Database["public"]["Tables"]["patch_notes"]["Row"];

type IntegrationSummary = {
  provider: EmailProviderId;
  displayName: string;
};

// Configure marked for GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Convert markdown to HTML
function markdownToHtml(markdown: string): string {
  return marked(markdown) as string;
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

function getProviderSummary(provider: IntegrationSummary) {
  return {
    provider: provider.provider,
    displayName: provider.displayName,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const integration = await getActiveIntegration(supabase);
    const provider = instantiateProvider(integration, { supabase });

    return NextResponse.json(
      getProviderSummary({
        provider: integration?.provider === "customerio" ? "customerio" : "resend",
        displayName: provider.displayName,
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load provider configuration" },
      { status: 500 }
    );
  }
}

// POST /api/patch-notes/[id]/send - Send patch note via email
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch the patch note
    const { data: patchNote, error: patchNoteError } = await supabase
      .from("patch_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (patchNoteError || !patchNote) {
      return NextResponse.json(
        { error: "Patch note not found" },
        { status: 404 }
      );
    }

    const { provider, subscribers } = await getActiveProviderWithSubscribers(
      supabase
    );

    const activeSubscribers = subscribers.filter((sub) => sub.active);

    if (activeSubscribers.length === 0) {
      return NextResponse.json(
        { error: "No active subscribers found" },
        { status: 400 }
      );
    }

    const htmlContent = markdownToHtml((patchNote as PatchNote).content);
    const baseUrl = getBaseUrl();
    const videoUrl = (patchNote as PatchNote).video_url
      ? `${baseUrl}${(patchNote as PatchNote).video_url}`
      : "https://openedit-uploads.openchatui.com/basecomp.mp4";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${(patchNote as PatchNote).title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      border-bottom: 3px solid #4F46E5;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #1a1a1a;
      margin: 0 0 10px 0;
    }
    .metadata {
      font-size: 14px;
      color: #666;
    }
    .badge {
      display: inline-block;
      background-color: #E0E7FF;
      color: #4F46E5;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 30px 0;
      padding: 20px;
      background-color: #F9FAFB;
      border-radius: 8px;
    }
    .stat {
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      margin-top: 4px;
    }
    .stat-value.added { color: #10B981; }
    .stat-value.modified { color: #3B82F6; }
    .stat-value.removed { color: #EF4444; }
    .content {
      margin-top: 30px;
    }
    .content h1 {
      font-size: 24px;
      margin-top: 30px;
      margin-bottom: 15px;
      color: #1a1a1a;
    }
    .content h2 {
      font-size: 20px;
      margin-top: 25px;
      margin-bottom: 12px;
      color: #333;
    }
    .content h3 {
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #444;
    }
    .content p {
      margin: 15px 0;
      line-height: 1.8;
    }
    .content ul, .content ol {
      margin: 15px 0;
      padding-left: 25px;
    }
    .content li {
      margin: 8px 0;
    }
    .content code {
      background-color: #F3F4F6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 14px;
    }
    .video-section {
      margin-top: 30px;
      background-color: #F9FAFB;
      border-radius: 8px;
      padding: 20px;
    }
    .video-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #4F46E5;
      text-decoration: none;
      font-weight: 600;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">${(patchNote as PatchNote).title}</h1>
      <div class="metadata">
        <span class="badge">${formatFilterSummary(
          (patchNote as PatchNote).filter_metadata
        )}</span>
        <span>${new Date(
          (patchNote as PatchNote).generated_at
        ).toLocaleDateString()}</span>
      </div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Additions</div>
        <div class="stat-value added">${
          (patchNote as PatchNote).changes?.added ?? 0
        }</div>
      </div>
      <div class="stat">
        <div class="stat-label">Modifications</div>
        <div class="stat-value modified">${
          (patchNote as PatchNote).changes?.modified ?? 0
        }</div>
      </div>
      <div class="stat">
        <div class="stat-label">Removals</div>
        <div class="stat-value removed">${
          (patchNote as PatchNote).changes?.removed ?? 0
        }</div>
      </div>
    </div>
    <div class="content">
      ${htmlContent}
    </div>
    <div class="video-section">
      <h3>Watch the highlight video</h3>
      <a class="video-link" href="${videoUrl}" target="_blank" rel="noreferrer">
        Watch recap →
      </a>
    </div>
  </div>
</body>
</html>
`;

    const sendResult = await provider.sendCampaign({
      subject: (patchNote as PatchNote).title,
      html: emailHtml,
      text: (patchNote as PatchNote).content,
      previewText: (patchNote as PatchNote).ai_overall_summary ?? undefined,
      recipients: activeSubscribers.map((sub) => sub.email),
    });

    return NextResponse.json({
      sentTo: sendResult.sentTo,
      provider: provider.displayName,
      providerId: provider.id,
    });
  } catch (error) {
    console.error("Failed to send patch note email", error);
    return NextResponse.json(
      { error: "Failed to send patch note email" },
      { status: 500 }
    );
  }
}
