import { test, expect } from '@playwright/test';
import {
  describeFilterSelection,
  generateBoilerplateContent,
  RepoStats,
  HistoryFilters,
} from '@/lib/github';

test.describe('patch note filtering labels', () => {
  const mockStats: RepoStats = {
    commits: 5,
    additions: 120,
    deletions: 30,
    contributors: ['alice', 'bob'],
    commitMessages: ['feat: shipping filters', 'fix: tidy helpers'],
  };

  test('custom range filters update boilerplate copy', () => {
    const filters: HistoryFilters = {
      customRange: {
        since: '2024-01-01T00:00:00.000Z',
        until: '2024-01-10T23:59:59.000Z',
      },
    };

    const label = describeFilterSelection(filters);
    expect(label).toContain('Custom Range');

    const content = generateBoilerplateContent('acme/repo', filters, mockStats);
    expect(content).toContain(label);
    expect(content).toContain('This summary covers changes made for');
  });

  test('release comparisons surface release names in summaries', () => {
    const filters: HistoryFilters = {
      releaseRange: { base: 'v1.0.0', head: 'v1.1.0' },
    };

    const label = describeFilterSelection(filters);
    expect(label).toBe('Release v1.0.0 → v1.1.0');

    const content = generateBoilerplateContent('acme/repo', filters, mockStats);
    expect(content).toContain('Release v1.0.0 → v1.1.0');
  });

  test('tag filters annotate summaries with include and exclude lists', () => {
    const filters: HistoryFilters = {
      preset: '1week',
      includeTags: ['v1.0.0', 'stable'],
      excludeTags: ['legacy'],
    };

    const label = describeFilterSelection(filters);
    expect(label).toContain('include tags: v1.0.0, stable');
    expect(label).toContain('exclude tags: legacy');

    const content = generateBoilerplateContent('acme/repo', filters, mockStats);
    expect(content).toContain('include tags: v1.0.0, stable');
    expect(content).toContain('exclude tags: legacy');
  });
});
