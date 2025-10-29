/**
 * GitHub Content Generation
 * Functions for generating boilerplate content from repository data
 */

import type { PatchNoteFilters } from '../types/patch-note';
import type { RepoStats } from './stats';
import {
  formatFilterSummary,
  formatFilterDetailLabel,
  getPresetLabel,
} from '../filter-utils';

/**
 * Generate boilerplate patch note content
 */
export function generateBoilerplateContent(
  repoName: string,
  filters: PatchNoteFilters | undefined,
  stats: RepoStats
): string {
  const descriptor =
    filters?.mode === 'preset' && filters.preset
      ? getPresetLabel(filters.preset)
      : filters?.mode === 'release'
      ? 'Release Selection'
      : 'Custom Range';
  const detailLabel = filters
    ? formatFilterDetailLabel(filters)
    : getPresetLabel('1week');

  const content = `# ${descriptor} Update for ${repoName}

## 📊 Overview

This summary covers changes made to the repository for ${detailLabel}.

**Period Statistics:**
- **${stats.commits}** commits
- **${stats.contributors.length}** active contributors
- **${stats.additions.toLocaleString()}** lines added
- **${stats.deletions.toLocaleString()}** lines removed

## 🚀 Highlights

${
    stats.commits > 0
      ? `
The team has been actively developing with ${stats.commits} commits during this timeframe.
Key areas of focus include ongoing development and improvements across the codebase.
`
      : 'No commits were made during this period.'
  }

## 📝 Recent Commits

${stats.commitMessages
    .slice(0, 10)
    .map((msg) => `- ${msg.split('\n')[0]}`)
    .join('\n')}

${
    stats.commitMessages.length > 10
      ? `\n_...and ${stats.commitMessages.length - 10} more commits_`
      : ''
  }

## 👥 Contributors

Thanks to all contributors who made this release possible:
${stats.contributors.join(', ')}

---

*Note: This is an auto-generated summary. AI-powered detailed analysis coming soon.*
`;

  return content;
}
