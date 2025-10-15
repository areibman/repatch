import { test, expect } from '@playwright/test';
import { buildPatchNoteContent, describeTemplateForPreview } from '@/lib/ai-template';
import type { CommitSummary } from '@/lib/ai-summarizer';
import type { AiTemplate } from '@/types/ai-template';

test.describe('AI template flows', () => {
  const commits: CommitSummary[] = [
    {
      sha: 'abc123',
      message: 'feat: add realtime metrics\n\nIncludes websocket streams',
      aiSummary: 'Added realtime metrics stream with websocket updates.',
      additions: 220,
      deletions: 14,
    },
    {
      sha: 'def456',
      message: 'fix: tighten auth rules',
      aiSummary: 'Tightened role checks for billing endpoints.',
      additions: 32,
      deletions: 9,
    },
  ];

  const executiveTemplate: AiTemplate = {
    id: 'executive',
    name: 'Executive Spotlight',
    description: 'High-level wins for stakeholders',
    audience: 'Non-technical',
    commitPrompt: 'Summarize the change for leaders in one energetic sentence.',
    overallPrompt: 'Celebrate the business impact in one short paragraph.',
    examples: {
      commitExamples: [
        {
          title: 'Improve conversion',
          summary: 'Streamlined checkout flow to lift conversions by 12%.',
        },
      ],
      overallExample: 'Product velocity focused on user growth and retention wins.',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const engineeringTemplate: AiTemplate = {
    id: 'engineering',
    name: 'Engineering Digest',
    description: 'Detailed notes for engineers',
    audience: 'Technical',
    commitPrompt: 'Summarize the change with the important technical trade-offs.',
    overallPrompt: 'Call out architectural movements and risk areas.',
    examples: {
      commitExamples: [
        {
          title: 'Cache tuning',
          summary: 'Cut p95 latency by precomputing expensive widgets at publish time.',
        },
      ],
      overallExample: 'This release focused on performance guardrails and auth hardening.',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test('default formatting keeps the Key Changes section', () => {
    const markdown = buildPatchNoteContent('Summary intro', commits, null);
    expect(markdown).toContain('## Key Changes');
    expect(markdown).toContain('**Changes:** +220 -14 lines');
  });

  test('template selection swaps in highlight heading', () => {
    const markdown = buildPatchNoteContent('Stakeholder summary', commits, executiveTemplate);
    expect(markdown).toContain('## Executive Spotlight Highlights');
    expect(markdown).not.toContain('## Key Changes');
  });

  test('regenerating with a different template updates output', () => {
    const executive = buildPatchNoteContent('Release recap', commits, executiveTemplate);
    const engineering = buildPatchNoteContent('Release recap', commits, engineeringTemplate);

    expect(engineering).not.toEqual(executive);
    expect(executive).toContain('Executive Spotlight Highlights');
    expect(engineering).toContain('Engineering Digest Highlights');
  });

  test('template previews describe tone and examples', () => {
    const preview = describeTemplateForPreview(executiveTemplate);
    expect(preview).toContain('Non-technical audience');
    expect(preview).toContain('Improve conversion');
  });
});
