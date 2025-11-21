import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { withApiAuth } from "@/lib/api/with-auth";
import { createServiceSupabaseClient, type Database } from "@/lib/supabase";
import { marked } from "marked";
import { formatFilterSummary } from "@/lib/filter-utils";
import type { PatchNoteFilters } from "@/types/patch-note";

type PatchNote = Database["public"]["Tables"]["patch_notes"]["Row"];

// Lazy-initialize Resend client to avoid build-time errors
function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

// Configure marked for GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Convert markdown to HTML
function markdownToHtml(markdown: string): string {
  return marked(markdown) as string;
}

// POST /api/patch-notes/[id]/send - Send patch note via email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(async ({ supabase, auth }) => {
    try {
      const { id } = await params;

      const { data: patchNote, error: patchNoteError } = await supabase
        .from("patch_notes")
        .select("*")
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .single();

      if (patchNoteError || !patchNote) {
        return NextResponse.json(
          { error: "Patch note not found" },
          { status: 404 }
        );
      }

      const note = patchNote as PatchNote;
      const contributors = note.contributors ?? [];
      const audienceId = "fa2a9141-3fa1-4d41-a873-5883074e6516";

      const resend = getResendClient();
      const contacts = await resend.contacts.list({ audienceId });

      if (!contacts.data || contacts.data.data.length === 0) {
        return NextResponse.json(
          { error: "No subscribers found in audience" },
          { status: 400 }
        );
      }

      const activeEmails = contacts.data.data
        .filter((contact: { unsubscribed?: boolean }) => !contact.unsubscribed)
        .map((contact: { email: string }) => contact.email);

      if (activeEmails.length === 0) {
        return NextResponse.json(
          { error: "No active subscribers found" },
          { status: 400 }
        );
      }

      const rawVideoUrl = note.video_url;
      if (!rawVideoUrl) {
        return NextResponse.json(
          {
            error:
              "Video is still rendering. Please wait until the video is ready before sending.",
          },
          { status: 400 }
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 600));

      const htmlContent = markdownToHtml(note.content || "");

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      let videoUrl: string;

      try {
        if (/^https?:\/\//i.test(rawVideoUrl)) {
          videoUrl = rawVideoUrl;
        } else {
          const serviceSupabase = createServiceSupabaseClient();
          const videoBucket = process.env.SUPABASE_VIDEO_BUCKET || "videos";

          const { data: signedData, error: signedError } =
            await serviceSupabase.storage
              .from(videoBucket)
              .createSignedUrl(rawVideoUrl, 31536000);

          if (signedData && !signedError) {
            videoUrl = signedData.signedUrl;
          } else {
            console.error("Failed to generate signed URL for email:", signedError);
            throw new Error("Failed to generate video URL");
          }
        }
      } catch (error) {
        console.error("Error generating signed URL:", error);
        return NextResponse.json(
          { error: "Failed to generate video URL for email. Please try again." },
          { status: 500 }
        );
      }

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title}</title>
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
    .content pre {
      background-color: #1F2937;
      color: #F9FAFB;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    .content pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    .contributors {
      margin-top: 30px;
      padding: 20px;
      background-color: #F9FAFB;
      border-radius: 8px;
    }
    .contributors-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .contributor-tag {
      display: inline-block;
      background-color: #E0E7FF;
      color: #4F46E5;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 13px;
      margin: 4px;
    }
    .ai-summaries {
      margin: 30px 0;
      padding: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: #ffffff;
    }
    .ai-summaries-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ai-badge {
      background-color: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .ai-summary-item {
      background-color: rgba(255, 255, 255, 0.1);
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 3px solid rgba(255, 255, 255, 0.5);
    }
    .ai-summary-item:last-child {
      margin-bottom: 0;
    }
    .ai-commit-title {
      font-size: 14px;
      font-weight: 600;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .ai-commit-summary {
      font-size: 14px;
      line-height: 1.6;
      opacity: 0.95;
    }
    .ai-stats {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 8px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      color: #6B7280;
      font-size: 13px;
    }
    .footer a {
      color: #4F46E5;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .hero-image {
      text-align: center;
      margin-bottom: 30px;
    }
    .hero-image img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero-image">
      <a href="${videoUrl}" target="_blank">
        <img src="${baseUrl}/preview.png" alt="Watch Patch Note Video" />
      </a>
    </div>
    
    <div class="header">
      <h1 class="title">${note.title}</h1>
      <div class="metadata">
        <span class="badge">${note.repo_name}</span>
        <span class="badge">${formatFilterSummary(
          note.filter_metadata as PatchNoteFilters | null,
          note.time_period
        )}</span>
        <span>${new Date(
          note.generated_at
        ).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Added</div>
        <div class="stat-value added">+${(
          note.changes as { added: number; modified: number; removed: number }
        ).added.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Removed</div>
        <div class="stat-value removed">-${(
          note.changes as { added: number; modified: number; removed: number }
        ).removed.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Contributors</div>
        <div class="stat-value">${contributors.length}</div>
      </div>
    </div>

    <div class="content">
      ${htmlContent}
    </div>

    ${
      contributors.length > 0
        ? `
    <div class="contributors">
      <div class="contributors-title">Contributors</div>
      <div>
        ${contributors
          .map(
            (contributor: string) =>
              `<span class="contributor-tag">${contributor}</span>`
          )
          .join("")}
      </div>
    </div>
    `
        : ""
    }

    <div class="footer">
      <p>
        View this patch note on the web: <a href="${note.repo_url}" target="_blank">${note.repo_name}</a>
      </p>
      <p>
        <small>This email was sent by Repatch - AI-powered patch notes for your repositories</small>
      </p>
    </div>
  </div>
</body>
</html>
    `;

      const { data, error } = await resend.emails.send({
        from: "Repatch <onboarding@resend.dev>",
        to: activeEmails,
        subject: `${note.title} - ${note.repo_name}`,
        html: emailHtml,
      });

      if (error) {
        console.error("Resend error:", error);
        return NextResponse.json(
          { error: error.message || "Failed to send email" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        sentTo: activeEmails.length,
        emailId: data?.id,
      });
    } catch (error) {
      console.error("API error:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to send email",
        },
        { status: 500 }
      );
    }
  });
}
