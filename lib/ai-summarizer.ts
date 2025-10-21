import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { PatchNoteFilters } from '@/types/patch-note';
import { formatFilterSummary, formatFilterDetailLabel } from './filter-utils';

export interface CommitSummary {
  sha: string;
  message: string;
  aiSummary: string;
  aiTitle?: string;
  additions: number;
  deletions: number;
  detailedContext?: string; // Internal detailed summary for Step 1
  prNumber?: number;
  authors?: string[];
}

export interface SummaryTemplate {
  id?: string;
  name?: string;
  content: string;
}

export const DEFAULT_TEMPLATE: SummaryTemplate = {
  name: 'Default Technical',
  content: `# Default Technical Template

This template is designed for engineering-focused audiences who care about implementation details and measurable performance improvements.

## Commit Summary Instructions

For each commit, write ONE CONCISE sentence (10-20 words max) that captures:
- The core change in plain language
- The immediate benefit or impact

DO NOT include:
- Line change metrics (no "+X -Y lines")
- Commit hashes or PR numbers (unless specifically relevant)
- Technical jargon unless necessary
- Verbose explanations

### Example Commit Summaries:
- **New PDF Search Category** — You can now search for only PDFs via our v2/search endpoints by specifying the .pdf category.
- **Gemini 2.5 Flash CLI Image Editor** — Create and edit images directly in the CLI using Firecrawl + Gemini 2.5 Flash integration.
- **Improved Crawl Status API** — More accurate and real-time crawl status reporting using the new crawl_status_2 RPC.

## Overall Summary Instructions

For the opening paragraph, write 1-2 tight sentences that:
- Summarize the dominant technical themes
- Quantify improvements when possible

DO NOT include:
- Total commit counts
- Line change metrics
- Overly verbose descriptions

### Example Opening:
We're excited to announce this release with powerful new search capabilities, AI-powered content generation, and significant reliability improvements across our infrastructure.
`,
};

function buildCommitPrompt(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplate,
  generateTitle?: boolean
): string {
  const resolved = template || DEFAULT_TEMPLATE;
  const titleInstructions = generateTitle ? `Generate a response in this exact format:
TITLE: [A short, descriptive title (3-6 words) that captures the essence of this change]
SUMMARY: [Your concise summary following the template guidelines]` : 
`Generate a concise summary following the template guidelines:`;

  return `You are analyzing a Git commit to create a concise, user-friendly summary for a changelog.

Follow these template guidelines:
---
${resolved.content}
---

Commit Message:
${commitMessage}

Diff Preview (first 2000 characters):
${diff.substring(0, 2000)}

${titleInstructions}`;
}

function buildOverallPrompt(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  commitSummaries: CommitSummary[],
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplate
): string {
  const resolved = template || DEFAULT_TEMPLATE;
  const filterLabel = formatFilterDetailLabel(filters);
  
  const keyChanges = commitSummaries.length > 0 ? `

Key changes in this release:
${commitSummaries.map((summary, index) => 
  `${index + 1}. ${summary.aiSummary || summary.message.split('\n')[0]}`
).join('\n')}` : '';

  return `You are writing a concise, engaging opening paragraph for a changelog newsletter.

Follow these template guidelines:
---
${resolved.content}
---

Repository: ${repoName}
Time Period: ${filterLabel}${keyChanges}

Generate a concise, engaging introduction (1-2 sentences) following the template guidelines.`;
}

/**
 * STEP 1: Generate detailed internal summary for a single commit/PR
 * This is a fixed prompt that gathers comprehensive context about the change
 */
export async function generateDetailedContext(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  authors: string[],
  repoOwner: string,
  repoName: string,
  prNumber?: number,
  prDetails?: {
    title: string;
    body: string | null;
    comments: Array<{ author: string; body: string }>;
    issueNumber?: number;
    issueTitle?: string;
    issueBody?: string | null;
  } | null
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('No Google API key found, skipping detailed context generation');
      return `${commitMessage}\n\n+${additions} -${deletions} lines by ${authors.join(', ')}`;
    }

    const google = createGoogleGenerativeAI({ apiKey });

    let prompt = `You are analyzing a code change to create a comprehensive internal summary.
This summary will be used as context for generating user-facing changelogs.

Analyze the commit and provide a DETAILED technical summary including:
1. What major features or functionality were added/changed/removed
2. Key technical improvements or refactoring
3. Performance gains or optimizations (if evident), fixes to race conditions, timeouts, bugs, security issue patches, library upgrades, etc.
4. Breaking changes or API modifications
5. Notable bug fixes
6. Context from PR discussions and linked issues
7. Libraries replaced or new libraries that add feature richness, speed, or dramatic improvements
8. Compatibility changes such as new file type support, API endpoints, SDK capabilities, etc.
9. New examples to documentaiton, videos, guides, or documents, README, github workflows/actions, etc.

In addition to looking at the commits, look at the PRs and the issues that were closed. Also look at the comments on the PRs and issues to see if there is any relevant context that is not in the commits.
`;
    
    if (prDetails) {
      prompt += `=== PULL REQUEST CONTEXT ===
PR #${prNumber}: ${prDetails.title}

`;
      if (prDetails.body) {
        prompt += `PR Description:
${prDetails.body}

`;
      }
      if (prDetails.issueNumber && prDetails.issueTitle) {
        prompt += `Linked Issue #${prDetails.issueNumber}: ${prDetails.issueTitle}
`;
        if (prDetails.issueBody) {
          prompt += `Issue Description:
${prDetails.issueBody}

`;
        }
      }
      if (prDetails.comments.length > 0) {
        prompt += `Discussion & Comments:
${prDetails.comments.map(comment => `- @${comment.author}: ${comment.body}`).join('\n')}

`;
      }
      prompt += `Link: https://github.com/${repoOwner}/${repoName}/pull/${prNumber}

=== CODE CHANGES ===
`;
    }
    
    prompt += `Commit Message:
${commitMessage}

Authors:
${authors.join(', ')}

Code Changes:
+${additions} lines added, -${deletions} lines removed

${prNumber && !prDetails ? `Pull Request: https://github.com/${repoOwner}/${repoName}/pull/${prNumber}\n\n` : ''}Diff Preview (first 2000 characters):
${diff.substring(0, 2000)}

Generate a comprehensive technical summary (4-6 sentences) covering the points above.
Be specific and technical. Use context from the PR description, linked issues, and discussions.
This is for internal context, not end users.`;

    console.log(`[Step 1] Generating detailed context for commit ${commitMessage.split('\n')[0].substring(0, 50)}...`);

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating detailed context:', error);
    return `${commitMessage}\n\n+${additions} -${deletions} lines by ${authors.join(', ')}`;
  }
}

/**
 * Generate AI summary for a single commit with its diff
 */
export async function summarizeCommit(
  commitMessage: string,
  diff: string,
  additions: number,
  deletions: number,
  template?: SummaryTemplate,
  generateTitle?: boolean
): Promise<{ summary: string; title?: string }> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('No Google API key found, skipping AI summarization');
      return { summary: commitMessage.split('\n')[0] }; // Return first line of commit message
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const prompt = buildCommitPrompt(
      commitMessage,
      diff,
      additions,
      deletions,
      template,
      generateTitle
    );
    
    console.log(`[AI Template] Using template: ${template?.name || 'DEFAULT'}`);
    console.log(`[AI Template] Generate title: ${generateTitle ? 'YES' : 'NO'}`);
    console.log(`[AI Template] Prompt length: ${prompt.length} chars`);

    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      prompt,
    });

    if (generateTitle) {
      // Parse the TITLE: and SUMMARY: format
      const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
      const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+?)$/i);
      
      return {
        title: titleMatch ? titleMatch[1].trim() : undefined,
        summary: summaryMatch ? summaryMatch[1].trim() : text.trim(),
      };
    }

    return { summary: text.trim() };
  } catch (error) {
    console.error('Error generating AI summary:', error);
    // Fallback to first line of commit message
    return { summary: commitMessage.split('\n')[0] };
  }
}

/**
 * Generate AI summaries for multiple commits
 */
export async function summarizeCommits(
  commits: Array<{
    sha: string;
    message: string;
    diff?: string;
    additions: number;
    deletions: number;
  }>,
  template?: SummaryTemplate,
  generateTitles?: boolean
): Promise<CommitSummary[]> {
  const summaries: CommitSummary[] = [];

  // Process ALL commits, sorted by significance
  const significantCommits = commits
    .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions));

  for (const commit of significantCommits) {
    const result = await summarizeCommit(
      commit.message,
      commit.diff || '',
      commit.additions,
      commit.deletions,
      template,
      generateTitles
    );

    summaries.push({
      sha: commit.sha,
      message: commit.message,
      aiSummary: result.summary,
      aiTitle: result.title,
      additions: commit.additions,
      deletions: commit.deletions,
    });
  }

  return summaries;
}

/**
 * STEP 2: Apply template to detailed contexts and generate final changelog
 * Takes all the detailed summaries from Step 1 and applies the user's template
 */
export async function generateFinalChangelog(
  repoOwner: string,
  repoName: string,
  filters: PatchNoteFilters | undefined,
  detailedContexts: Array<{
    context: string;
    message: string;
    additions: number;
    deletions: number;
    authors: string[];
    prNumber?: number;
  }>,
  template?: SummaryTemplate
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return detailedContexts
        .map((c) => `- ${c.message.split('\n')[0]}\n  ${c.context}`)
        .join('\n\n');
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const resolved = template || DEFAULT_TEMPLATE;
    const filterLabel = formatFilterDetailLabel(filters);

    const changesDetail = detailedContexts.map((item, index) => `--- Change ${index + 1} ---
Commit: ${item.message.split('\n')[0]}
Authors: ${item.authors.join(', ')}
Code Changes: +${item.additions} -${item.deletions} lines${item.prNumber ? `
PR Link: https://github.com/${repoOwner}/${repoName}/pull/${item.prNumber}` : ''}

Technical Summary:
${item.context}`).join('\n\n');

    const prompt = `You are writing a professional changelog for end users based on technical summaries.

Use this template/style guide:
---
${resolved.content}
---

Repository: ${repoOwner}/${repoName}
Time Period: ${filterLabel}
Total Changes: ${detailedContexts.length}

Here are the detailed technical summaries of all changes:

${changesDetail}

Generate a complete, polished changelog following the template style.
Start with 1-2 sentences introducing the release, then list the changes.
Format the changes in a clean, organized way that makes sense for end users.

Make sure to include the following as key points in the changelog:
1. What major features or functionality were added/changed/removed
2. Key technical improvements or refactoring
3. Performance gains or optimizations (if evident), fixes to race conditions, timeouts, bugs, security issue patches, library upgrades, etc.
4. Breaking changes or API modifications
5. Notable bug fixes
6. Context from PR discussions and linked issues
7. Libraries replaced or new libraries that add feature richness, speed, or dramatic improvements
8. Compatibility changes such as new file type support, API endpoints, SDK capabilities, etc.
9. New examples to documentaiton, videos, guides, or documents, README, github workflows/actions, etc.
`;

    console.log(`[Step 2] Generating final changelog from ${detailedContexts.length} detailed contexts`);
    console.log(`[Step 2] Using template: ${template?.name || 'DEFAULT'}`);
    console.log(`[Step 2] Prompt length: ${prompt.length} chars`);

    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      prompt,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating final changelog:', error);
    return detailedContexts
      .map((c) => `- ${c.message.split('\n')[0]}\n  ${c.context}`)
      .join('\n\n');
  }
}

/**
 * Format all commit summaries into a clean, categorized changelog
 * This is the final LLM call that organizes everything into a polished format
 */
export async function formatChangelogFromSummaries(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  commitSummaries: CommitSummary[],
  totalCommits: number,
  template?: SummaryTemplate
): Promise<{ intro: string; formattedChanges: string }> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        intro: `Changes in ${repoName} (${totalCommits} commits)`,
        formattedChanges: commitSummaries
          .map((s) => `- ${s.aiSummary}`)
          .join('\n'),
      };
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const resolved = template || DEFAULT_TEMPLATE;
    const filterLabel = formatFilterDetailLabel(filters);

    const summariesList = commitSummaries.map((summary, index) => 
      `${index + 1}. ${summary.aiTitle || summary.message.split('\n')[0]}
   ${summary.aiSummary}`
    ).join('\n\n');

    const prompt = `You are formatting a professional changelog from commit summaries.
Your job is to take the individual commit summaries below and organize them into a clean, categorized list.

Repository: ${repoName}
Time Period: ${filterLabel}
Total Commits: ${totalCommits}

Here are the commit summaries to organize:

${summariesList}

Generate a response in this EXACT format:

INTRO:
Write 1-2 engaging sentences that summarize the release.

CHANGES:
# 🆕 New Features

- **New PDF Search Category** — You can now search for only PDFs via our v2/search endpoints by specifying the .pdf category.
- **Gemini 2.5 Flash CLI Image Editor** — Create and edit images directly in the CLI using Firecrawl + Gemini 2.5 Flash integration.
- **x402 Search Endpoint** — Added a next-gen search API with improved accuracy and speed.

---

# ⚙️ Improvements

- **Reduced Docker Image Size** — Playwright service image size reduced by 1 GB by only installing Chromium.
- **Python SDK Enhancements** — Added "cancelled" job status handling and poll interval fixes.
- **Faster Node SDK Timeouts** — Axios timeouts now propagate correctly, improving reliability under heavy loads.


CRITICAL RULES:
1. Organize changes into logical categories (New Features, Improvements, Bug Fixes, etc.)
2. Each bullet should be: - **Short Name** — One sentence description.
3. Keep descriptions to 10-20 words maximum
4. DO NOT include ANY line counts, commit metrics, or "+X -Y lines"
5. DO NOT include PR numbers unless they are part of the feature name
6. Merge similar changes into single bullets where appropriate
7. Only include categories that have items (omit empty sections)`;

    console.log(`[AI Changelog] Formatting ${commitSummaries.length} summaries into final changelog`);
    console.log(`[AI Changelog] Prompt length: ${prompt.length} chars`);

    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      prompt,
    });

    // Parse the response
    const introMatch = text.match(/INTRO:\s*([\s\S]*?)(?=CHANGES:|$)/i);
    const changesMatch = text.match(/CHANGES:\s*([\s\S]*?)$/i);

    return {
      intro: introMatch ? introMatch[1].trim() : text.split('\n')[0],
      formattedChanges: changesMatch ? changesMatch[1].trim() : text,
    };
  } catch (error) {
    console.error('Error formatting changelog:', error);
    return {
      intro: `Changes in ${repoName} (${totalCommits} commits)`,
      formattedChanges: commitSummaries
        .map((s) => `- **${s.aiTitle || s.message.split('\n')[0]}** — ${s.aiSummary}`)
        .join('\n'),
    };
  }
}

/**
 * Generate an overall summary of all changes for the email
 */
export async function generateOverallSummary(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  commitSummaries: CommitSummary[],
  totalCommits: number,
  totalAdditions: number,
  totalDeletions: number,
  template?: SummaryTemplate
): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const label = formatFilterSummary(
        filters,
        filters?.mode === 'release'
          ? 'release'
          : filters?.mode === 'custom'
          ? 'custom'
          : filters?.preset ?? '1week'
      );
      return `This ${label.toLowerCase()} window saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    
    const prompt = buildOverallPrompt(
      repoName,
      filters,
      commitSummaries,
      totalCommits,
      totalAdditions,
      totalDeletions,
      template
    );
    
    console.log(`[AI Template] Overall summary using template: ${template?.name || 'DEFAULT'}`);
    console.log(`[AI Template] Overall prompt length: ${prompt.length} chars`);
    
    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      prompt,
    });

    return text.trim();
  } catch (error) {
    console.error('Error generating overall summary:', error);
    const fallbackLabel = formatFilterSummary(
      filters,
      filters?.mode === 'release'
        ? 'release'
        : filters?.mode === 'custom'
        ? 'custom'
        : filters?.preset ?? '1week'
    );
    return `This ${fallbackLabel.toLowerCase()} window saw ${totalCommits} commits with ${totalAdditions} additions and ${totalDeletions} deletions.`;
  }
}

function stripHashtags(text: string): string {
  return text.replace(/#[A-Za-z][\w-]*/g, (match) => match.slice(1));
}

function splitIntoTweetLength(text: string): string[] {
  const tweets: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 280) {
    let slice = remaining.slice(0, 280);
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > 200) {
      slice = slice.slice(0, lastSpace);
    }
    tweets.push(slice.trim());
    remaining = remaining.slice(slice.length).trimStart();
  }

  if (remaining.length > 0) {
    tweets.push(remaining);
  }

  return tweets;
}

interface TweetThreadParams {
  repoName: string;
  title: string;
  changelogMarkdown: string;
  overallSummary?: string | null;
  commitSummaries?: CommitSummary[] | null;
}

export async function generateTweetThreadFromChangelog({
  repoName,
  title,
  changelogMarkdown,
  overallSummary,
  commitSummaries,
}: TweetThreadParams): Promise<string[]> {
  const buildFallback = (): string[] => {
    const fallbackTweets: string[] = [
      `Update from ${repoName}: ${title}`,
    ];

    if (overallSummary) {
      fallbackTweets.push(overallSummary.slice(0, 276));
    }

    if (commitSummaries && commitSummaries.length > 0) {
      const highlights = commitSummaries.slice(0, 3).map((summary) => {
        const label = summary.aiTitle || summary.message.split('\n')[0];
        return `${label}: ${summary.aiSummary}`;
      });
      fallbackTweets.push(...highlights.map((highlight) => highlight.slice(0, 276)));
    }

    return fallbackTweets.slice(0, 5);
  };

  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return buildFallback();
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const highlightList = commitSummaries
      ?.slice(0, 10)
      .map((summary, index) =>
        `${index + 1}. ${(summary.aiTitle || summary.message.split('\n')[0]).trim()} — ${summary.aiSummary}`
      )
      .join('\n');

    const prompt = `You are a social media copywriter creating an X (Twitter) thread about a recent product update.\n\n` +
      `Repository: ${repoName}\n` +
      `Release Title: ${title}\n` +
      `${overallSummary ? `Overall Summary: ${overallSummary}\n` : ''}` +
      `Markdown Changelog:\n${changelogMarkdown}\n\n` +
      `${highlightList ? `Key Highlights:\n${highlightList}\n\n` : ''}` +
      `Write a polished, professional Twitter thread that teases the highlights first and walks readers through the changes.\n` +
      `Rules:\n` +
      `- NEVER use hashtags.\n` +
      `- Keep the tone concise, energetic, and informative.\n` +
      `- Each tweet must be fewer than 270 characters to stay within 280 after accounting for extra spaces.\n` +
      `- Include clear calls-to-action only when appropriate (link to repo if helpful).\n` +
      `- Return the thread as pure JSON: an array of tweet strings in order. No extra commentary or code fences.`;

    const { text } = await generateText({
      model: google('gemini-2.5-pro'),
      prompt,
    });

    const response = text.trim();
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const payload = jsonMatch ? jsonMatch[0] : response;
    const parsed = JSON.parse(payload);

    if (!Array.isArray(parsed)) {
      return buildFallback();
    }

    const flattened = parsed.flatMap((item) => {
      if (typeof item !== 'string') {
        return [];
      }

      const sanitized = stripHashtags(item).replace(/```/g, '').trim();
      return splitIntoTweetLength(sanitized);
    }).filter((tweet) => tweet.length > 0);

    return flattened.length > 0 ? flattened : buildFallback();
  } catch (error) {
    console.error('Error generating tweet thread:', error);
    return buildFallback();
  }
}
