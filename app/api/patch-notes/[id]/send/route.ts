import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { marked } from 'marked';
import { Database } from '@/lib/supabase/database.types';

type PatchNote = Database['public']['Tables']['patch_notes']['Row'];

const resend = new Resend(process.env.RESEND_API_KEY);

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
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch the patch note
    const { data: patchNote, error: patchNoteError } = await supabase
      .from('patch_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (patchNoteError || !patchNote) {
      return NextResponse.json(
        { error: 'Patch note not found' },
        { status: 404 }
      );
    }

    // Fetch active email subscribers
    const { data: subscribers, error: subscribersError } = await supabase
      .from('email_subscribers')
      .select('email')
      .eq('active', true);

    if (subscribersError) {
      return NextResponse.json(
        { error: 'Failed to fetch subscribers' },
        { status: 500 }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json(
        { error: 'No active subscribers found' },
        { status: 400 }
      );
    }

    // Extract email addresses
    const recipientEmails = subscribers.map((s: { email: string }) => s.email);

    // Convert markdown content to HTML
    const htmlContent = markdownToHtml((patchNote as PatchNote).content);

    // Create styled HTML email
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">${(patchNote as PatchNote).title}</h1>
      <div class="metadata">
        <span class="badge">${(patchNote as PatchNote).repo_name}</span>
        <span class="badge">${(patchNote as PatchNote).time_period === '1day' ? 'Daily' : (patchNote as PatchNote).time_period === '1week' ? 'Weekly' : 'Monthly'}</span>
        <span>${new Date((patchNote as PatchNote).generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Added</div>
        <div class="stat-value added">+${(patchNote as PatchNote).changes.added.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Removed</div>
        <div class="stat-value removed">-${(patchNote as PatchNote).changes.removed.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Contributors</div>
        <div class="stat-value">${(patchNote as PatchNote).contributors.length}</div>
      </div>
    </div>

    <div class="content">
      ${htmlContent}
    </div>

    ${(patchNote as PatchNote).contributors && (patchNote as PatchNote).contributors.length > 0 ? `
    <div class="contributors">
      <div class="contributors-title">Contributors</div>
      <div>
        ${(patchNote as PatchNote).contributors.map((contributor: string) => `<span class="contributor-tag">${contributor}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <p>
        View this patch note on the web: <a href="${(patchNote as PatchNote).repo_url}" target="_blank">${(patchNote as PatchNote).repo_name}</a>
      </p>
      <p>
        <small>This email was sent by Repatch - AI-powered patch notes for your repositories</small>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Repatch <onboarding@resend.dev>',
      to: recipientEmails,
      subject: `${(patchNote as PatchNote).title} - ${(patchNote as PatchNote).repo_name}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sentTo: recipientEmails.length,
      emailId: data?.id,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}

