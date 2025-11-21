"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2Icon, PlusIcon } from "lucide-react";
import type { AiTemplate } from "@/types/ai-template";

interface TemplateFormState {
  id?: string;
  name: string;
  content: string;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  content: "",
};

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState<TemplateFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/ai-templates");
        if (response.status === 401) {
          setTemplates([]);
          return;
        }

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to load templates");
        }

        const data = (await response.json()) as AiTemplate[];
        setTemplates(data);
      } catch (err) {
        console.error("Error loading templates:", err);
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const openCreateDialog = () => {
    setFormState(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: AiTemplate) => {
    setFormState({
      id: template.id,
      name: template.name,
      content: template.content || "",
    });
    setIsDialogOpen(true);
  };

  const resetDialog = () => {
    setIsDialogOpen(false);
    setFormState(EMPTY_FORM);
    setIsSubmitting(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.name.trim()) {
      alert("Template name is required");
      return;
    }

    if (!formState.content.trim()) {
      alert("Template content is required");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: formState.name.trim(),
      content: formState.content.trim(),
    };

    try {
      if (formState.id) {
        const response = await fetch(`/api/ai-templates/${formState.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to update template");
        }

        const updated = (await response.json()) as AiTemplate;
        setTemplates((prev) =>
          prev.map((template) => (template.id === updated.id ? updated : template))
        );
      } else {
        const response = await fetch("/api/ai-templates", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to create template");
        }

        const created = (await response.json()) as AiTemplate;
        setTemplates((prev) => [created, ...prev]);
      }

      resetDialog();
    } catch (err) {
      console.error("Error saving template:", err);
      alert(err instanceof Error ? err.message : "Failed to save template");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (template: AiTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ai-templates/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete template");
      }

      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
    } catch (err) {
      console.error("Error deleting template:", err);
      alert(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Templates</h1>
          <p className="text-muted-foreground">
            Create markdown-based templates that guide AI-generated patch notes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Back to dashboard</Link>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <PlusIcon className="mr-2 h-4 w-4" />
                New template
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[680px]">
              <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>
                    {formState.id ? "Edit template" : "Create template"}
                  </DialogTitle>
                  <DialogDescription>
                    Use markdown to structure your template with headings, lists, and examples.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 overflow-y-auto px-1 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g., Technical Deep Dive"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="template-content">Template Content</Label>
                    <Textarea
                      id="template-content"
                      value={formState.content}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          content: event.target.value,
                        }))
                      }
                      placeholder="# My Template&#10;&#10;Write instructions for how commits and summaries should be written...&#10;&#10;## Example Summaries:&#10;- **Feature X**: Description of what it does"
                      rows={20}
                      className="font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Use markdown syntax to structure your template. Include instructions, examples, and tone guidance.
                    </p>
                  </div>
                </div>

                <DialogFooter className="flex-shrink-0">
                  <Button type="button" variant="outline" onClick={resetDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : formState.id ? (
                      "Save changes"
                    ) : (
                      "Create template"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {isLoading ? (
        <div className="rounded-lg border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          Loading templates...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No templates yet</CardTitle>
            <CardDescription>
              Start by creating a template that guides how your patch notes should be written.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={openCreateDialog}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create your first template
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-md bg-muted/30 p-4 font-mono text-xs">
                  {template.content}
                </div>
              </CardContent>
              <CardFooter className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(template)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
