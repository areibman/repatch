export interface PatchNote {
  id: string;
  repoName: string;
  repoUrl: string;
  timePeriod: '1day' | '1week' | '1month';
  generatedAt: Date;
  title: string;
  content: string;
  changes: {
    added: number;
    modified: number;
    removed: number;
  };
  contributors: string[];
}

