'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PatchNote } from '@/types/patch-note';
import { ArrowLeftIcon, PencilIcon, SaveIcon, SendIcon, XIcon } from 'lucide-react';

// Mock data - replace with actual API call
const getMockPatchNote = (id: string): PatchNote => ({
  id,
  repoName: 'acme/awesome-project',
  repoUrl: 'https://github.com/acme/awesome-project',
  timePeriod: '1week',
  generatedAt: new Date(),
  title: 'Weekly Update: New Features and Bug Fixes',
  content: `# What's New This Week

We've been hard at work improving the platform! Here's what changed:

## 🚀 New Features

- **Enhanced Authentication**: Implemented OAuth2 support for third-party integrations
- **Dashboard Redesign**: Completely revamped the user dashboard with a modern, intuitive interface
- **Real-time Notifications**: Added WebSocket support for instant updates

## 🐛 Bug Fixes

- Fixed memory leak in the background worker process
- Resolved race condition in the payment processing pipeline
- Corrected timezone handling for international users

## 📈 Performance Improvements

- Reduced API response times by 40%
- Optimized database queries for faster page loads
- Implemented caching layer for frequently accessed data

## 🔧 Technical Updates

- Updated dependencies to latest stable versions
- Improved test coverage to 85%
- Enhanced error logging and monitoring

Thanks to all our contributors for making this release possible!`,
  changes: {
    added: 2543,
    modified: 1823,
    removed: 456,
  },
  contributors: ['@alice', '@bob', '@charlie', '@diana'],
});

export default function BlogViewPage() {
  const params = useParams();
  const router = useRouter();
  const [patchNote, setPatchNote] = useState<PatchNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // In production, fetch from API
    const note = getMockPatchNote(params.id as string);
    setPatchNote(note);
    setEditedContent(note.content);
    setEditedTitle(note.title);
  }, [params.id]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (patchNote) {
      setEditedContent(patchNote.content);
      setEditedTitle(patchNote.title);
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // TODO: Implement actual API call to save changes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (patchNote) {
      setPatchNote({
        ...patchNote,
        title: editedTitle,
        content: editedContent,
      });
    }
    
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    
    // TODO: Implement actual API call to send emails
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    alert('Patch notes sent to all recipients!');
    setIsSending(false);
  };

  const getTimePeriodLabel = (period: string) => {
    switch (period) {
      case '1day': return 'Daily';
      case '1week': return 'Weekly';
      case '1month': return 'Monthly';
      default: return period;
    }
  };

  if (!patchNote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">
                  {getTimePeriodLabel(patchNote.timePeriod)}
                </Badge>
                <Badge variant="outline">
                  {new Date(patchNote.generatedAt).toLocaleDateString()}
                </Badge>
              </div>
              
              {isEditing ? (
                <Textarea
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-3xl font-bold mb-2 min-h-[60px] resize-none"
                  placeholder="Enter title..."
                />
              ) : (
                <h1 className="text-4xl font-bold mb-2">{patchNote.title}</h1>
              )}
              
              <a
                href={patchNote.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {patchNote.repoName}
              </a>
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                  >
                    <XIcon className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    <SaveIcon className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={isSending}
                  >
                    <SendIcon className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : 'Send Email'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Lines Added</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                +{patchNote.changes.added.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Lines Modified</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                ~{patchNote.changes.modified.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Lines Removed</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                -{patchNote.changes.removed.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Patch Notes</CardTitle>
            <CardDescription>
              AI-generated summary of changes for this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Enter patch notes content..."
              />
            ) : (
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {patchNote.content}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contributors */}
        <Card>
          <CardHeader>
            <CardTitle>Contributors</CardTitle>
            <CardDescription>
              Thanks to everyone who contributed to this release
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {patchNote.contributors.map((contributor) => (
                <Badge key={contributor} variant="secondary">
                  {contributor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

