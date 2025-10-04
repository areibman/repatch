'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PatchNote } from '@/types/patch-note';
import { PlusIcon, GitBranchIcon, CalendarIcon, UsersIcon } from 'lucide-react';

// Mock data - replace with actual API call
const getMockPatchNotes = (): PatchNote[] => [
  {
    id: '1',
    repoName: 'acme/awesome-project',
    repoUrl: 'https://github.com/acme/awesome-project',
    timePeriod: '1week',
    generatedAt: new Date('2025-10-01'),
    title: 'Weekly Update: New Features and Bug Fixes',
    content: 'Enhanced authentication, dashboard redesign, and performance improvements...',
    changes: { added: 2543, modified: 1823, removed: 456 },
    contributors: ['@alice', '@bob', '@charlie', '@diana'],
  },
  {
    id: '2',
    repoName: 'acme/awesome-project',
    repoUrl: 'https://github.com/acme/awesome-project',
    timePeriod: '1month',
    generatedAt: new Date('2025-09-30'),
    title: 'September Monthly Recap: Major Milestone Release',
    content: 'This month brought significant updates including API v2, mobile app launch, and security enhancements...',
    changes: { added: 8234, modified: 4521, removed: 1203 },
    contributors: ['@alice', '@bob', '@charlie', '@diana', '@eve', '@frank'],
  },
  {
    id: '3',
    repoName: 'techcorp/api-gateway',
    repoUrl: 'https://github.com/techcorp/api-gateway',
    timePeriod: '1day',
    generatedAt: new Date('2025-10-04'),
    title: 'Daily Update: Critical Hotfixes',
    content: 'Fixed authentication timeout issues and improved rate limiting logic...',
    changes: { added: 145, modified: 89, removed: 23 },
    contributors: ['@alice', '@bob'],
  },
  {
    id: '4',
    repoName: 'techcorp/api-gateway',
    repoUrl: 'https://github.com/techcorp/api-gateway',
    timePeriod: '1week',
    generatedAt: new Date('2025-09-28'),
    title: 'Weekly Progress: Performance Optimization',
    content: 'Significant performance improvements with new caching strategy and database optimizations...',
    changes: { added: 1456, modified: 892, removed: 234 },
    contributors: ['@alice', '@bob', '@charlie'],
  },
  {
    id: '5',
    repoName: 'startup/mobile-app',
    repoUrl: 'https://github.com/startup/mobile-app',
    timePeriod: '1week',
    generatedAt: new Date('2025-09-25'),
    title: 'Weekly Update: UI Refresh and New Screens',
    content: 'Complete redesign of profile screen, added dark mode support, and implemented push notifications...',
    changes: { added: 3421, modified: 2134, removed: 567 },
    contributors: ['@designer', '@developer', '@qa'],
  },
  {
    id: '6',
    repoName: 'startup/mobile-app',
    repoUrl: 'https://github.com/startup/mobile-app',
    timePeriod: '1month',
    generatedAt: new Date('2025-09-01'),
    title: 'August Monthly Summary: Beta Launch',
    content: 'Successfully launched beta version with 1000+ users, implemented feedback system, and fixed critical bugs...',
    changes: { added: 12453, modified: 6782, removed: 2341 },
    contributors: ['@designer', '@developer', '@qa', '@pm', '@lead'],
  },
];

export default function Home() {
  const [patchNotes] = useState<PatchNote[]>(getMockPatchNotes());

  const getTimePeriodLabel = (period: string) => {
    switch (period) {
      case '1day': return 'Daily';
      case '1week': return 'Weekly';
      case '1month': return 'Monthly';
      default: return period;
    }
  };

  const getTimePeriodColor = (period: string) => {
    switch (period) {
      case '1day': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case '1week': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case '1month': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Repatch</h1>
            <p className="text-muted-foreground text-sm mt-1">
              AI-generated patch notes from your repositories
            </p>
          </div>
          <Button size="lg">
            <PlusIcon className="h-5 w-5 mr-2" />
            Create New Post
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{patchNotes.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Repositories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {new Set(patchNotes.map(p => p.repoName)).size}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {patchNotes.filter(p => {
                  const date = new Date(p.generatedAt);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patch Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patchNotes.map((note) => (
            <Link key={note.id} href={`/blog/${note.id}`}>
              <Card className="h-full hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant="outline" 
                      className={getTimePeriodColor(note.timePeriod)}
                    >
                      {getTimePeriodLabel(note.timePeriod)}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      {new Date(note.generatedAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  
                  <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                    {note.title}
                  </CardTitle>
                  
                  <CardDescription className="flex items-center gap-1 mt-2">
                    <GitBranchIcon className="h-3 w-3" />
                    {note.repoName}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {note.content}
                  </p>
                  
                  {/* Change Stats */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-green-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-green-700 dark:text-green-400">
                        +{note.changes.added.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">added</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-blue-700 dark:text-blue-400">
                        ~{note.changes.modified.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">modified</div>
                    </div>
                    <div className="bg-red-500/10 rounded-md p-2 text-center">
                      <div className="font-semibold text-red-700 dark:text-red-400">
                        -{note.changes.removed.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-[10px]">removed</div>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <UsersIcon className="h-3 w-3" />
                    {note.contributors.length} contributor{note.contributors.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-primary font-medium group-hover:underline">
                    Read more →
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State (shown when no posts) */}
        {patchNotes.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <GitBranchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No patch notes yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first patch note to get started
              </p>
              <Button>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create New Post
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by AI · Built with Next.js</p>
        </div>
      </footer>
    </div>
  );
}
