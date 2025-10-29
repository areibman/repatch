/**
 * GitHub Pull Requests API
 * Functions for fetching pull request details and comments
 */

import { getOctokit } from '../client';
import { safeExecute } from '../error';
import type { PullRequestDetails } from '../types';

/**
 * Fetch pull request details including body, comments, and linked issues
 */
export async function fetchPullRequestDetails(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequestDetails | null> {
  return safeExecute(
    async () => {
      const octokit = getOctokit();

      // Fetch PR details
      const { data: prData } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Fetch PR comments
      const { data: commentsData } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
      });

      const comments = commentsData.map(comment => ({
        author: comment.user?.login || 'unknown',
        body: comment.body || '',
      }));

      // Extract linked issue from PR body if present
      let issueNumber: number | undefined;
      let issueTitle: string | undefined;
      let issueBody: string | null = null;

      const issueMatch = prData.body?.match(/#(\d+)|closes #(\d+)|fixes #(\d+)/i);
      if (issueMatch) {
        issueNumber = parseInt(issueMatch[1] || issueMatch[2] || issueMatch[3], 10);

        // Fetch the linked issue
        try {
          const { data: issueData } = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
          });

          issueTitle = issueData.title;
          issueBody = issueData.body || null;
        } catch {
          // Issue fetch failed, continue without it
        }
      }

      return {
        title: prData.title,
        body: prData.body,
        comments,
        issueNumber,
        issueTitle,
        issueBody,
      };
    },
    null,
    false // Don't log errors - PR might not exist
  );
}

