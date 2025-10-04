'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusIcon } from 'lucide-react';

export function CreatePostDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [timePeriod, setTimePeriod] = useState<'1day' | '1week' | '1month'>('1week');

  const extractRepoInfo = (url: string) => {
    // Extract owner/repo from various GitHub URL formats
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        fullName: `${match[1]}/${match[2].replace(/\.git$/, '')}`,
      };
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const repoInfo = extractRepoInfo(repoUrl);
    if (!repoInfo) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Replace this with actual AI generation
      // For now, create a placeholder post
      const response = await fetch('/api/patch-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo_name: repoInfo.fullName,
          repo_url: repoUrl,
          time_period: timePeriod,
          title: `${timePeriod === '1day' ? 'Daily' : timePeriod === '1week' ? 'Weekly' : 'Monthly'} Update - ${repoInfo.repo}`,
          content: `# Patch Notes for ${repoInfo.fullName}

## 🚀 Summary

This is a placeholder patch note. AI generation will be implemented soon.

## Changes Overview

- Placeholder content
- AI generation coming soon
- Real GitHub data integration pending

## Next Steps

Integrate with LiteLLM + AWS Bedrock to generate actual content from GitHub commits.`,
          changes: {
            added: 0,
            modified: 0,
            removed: 0,
          },
          contributors: [],
          generated_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create patch note');
      }

      const data = await response.json();
      
      // Close modal and redirect to the new post
      setOpen(false);
      setRepoUrl('');
      router.push(`/blog/${data.id}`);
      router.refresh();
    } catch (error) {
      console.error('Error creating patch note:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create patch note';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create New Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Patch Note</DialogTitle>
            <DialogDescription>
              Generate AI-powered patch notes from a GitHub repository.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repo-url">
                Repository URL
              </Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the full GitHub repository URL
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="time-period">
                Time Period
              </Label>
              <Select
                value={timePeriod}
                onValueChange={(value) => setTimePeriod(value as '1day' | '1week' | '1month')}
                disabled={isLoading}
              >
                <SelectTrigger id="time-period">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1day">Last 24 Hours</SelectItem>
                  <SelectItem value="1week">Last Week</SelectItem>
                  <SelectItem value="1month">Last Month</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the time range for analyzing changes
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Patch Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

