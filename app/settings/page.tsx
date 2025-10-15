"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AiTemplate } from "@/types/ai-template";
import {
  describeTemplateForPreview,
  fromApiTemplate,
} from "@/lib/ai-template";
import { Loader2Icon } from "lucide-react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";

interface TemplateFormState {
  name: string;
  description: string;
  audience: string;
  commitPrompt: string;
  overallPrompt: string;
  commitExamples: Array<{ title: string; summary: string }>;
  overallExample: string;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  description: "",
  audience: "Technical",
  commitPrompt:
    "You are summarizing code changes for engineers. Highlight the important details in one or two sentences.",
  overallPrompt: "Write a short intro that frames the release for the chosen audience.",
  commitExamples: [
    {
      title: "Improve build performance",
      summary: "Cut CI time in half by caching pnpm dependencies and parallelizing tests.",
    },
  ],
  overallExample:
    "We focused on developer productivity this week, trimming build times and strengthening test coverage.",
};

function templateToForm(template: AiTemplate): TemplateFormState {
  return {
    name: template.name,
    description: template.description ?? "",
    audience: template.audience,
    commitPrompt: template.commitPrompt,
    overallPrompt: template.overallPrompt,
    commitExamples:
      template.examples.commitExamples.length > 0
        ? template.examples.commitExamples
        : EMPTY_FORM.commitExamples,
    overallExample: template.examples.overallExample ?? "",
  };
}

export default function SettingsPage() {
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AiTemplate | null>(null);
  const [formState, setFormState] = useState<TemplateFormState>(EMPTY_FORM);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ai-templates");
        if (!response.ok) {
          throw new Error("Failed to load templates");
        }

        const data = await response.json();
        const parsed = (data || []).map((item: any) => fromApiTemplate(item));
        setTemplates(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      setFormState(EMPTY_FORM);
      setEditingTemplate(null);
    }
  }, [isDialogOpen]);

  const dialogTitle = useMemo(
    () => (editingTemplate ? "Edit template" : "Create template"),
    [editingTemplate]
  );

  const handleAddExample = () => {
    setFormState((prev) => ({
      ...prev,
      commitExamples: [...prev.commitExamples, { title: "", summary: "" }],
    }));
  };

  const handleRemoveExample = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      commitExamples: prev.commitExamples.filter((_, i) => i !== index),
    }));
  };

  const updateExample = (index: number, field: "title" | "summary", value: string) => {
    setFormState((prev) => {
      const next = [...prev.commitExamples];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return {
        ...prev,
        commitExamples: next,
      };
    });
  };

  const validateForm = () => {
    if (!formState.name.trim()) {
      alert("Name is required");
      return false;
    }

    if (!formState.commitPrompt.trim()) {
      alert("Commit prompt is required");
      return false;
    }

    if (!formState.overallPrompt.trim()) {
      alert("Overall prompt is required");
      return false;
    }

    const hasExample = formState.commitExamples.some(
      (example) => example.title.trim() && example.summary.trim()
    );

    if (!hasExample) {
      alert("Add at least one commit example to guide the AI");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      audience: formState.audience.trim() || "Technical",
      commitPrompt: formState.commitPrompt.trim(),
      overallPrompt: formState.overallPrompt.trim(),
      examples: {
        commitExamples: formState.commitExamples
          .filter((example) => example.title.trim() && example.summary.trim())
          .map((example) => ({
            title: example.title.trim(),
            summary: example.summary.trim(),
          })),
        overallExample: formState.overallExample.trim() || undefined,
      },
    };

    try {
      const response = await fetch(
        editingTemplate ? `/api/ai-templates/${editingTemplate.id}` : "/api/ai-templates",
        {
          method: editingTemplate ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      const saved = fromApiTemplate(await response.json());

      setTemplates((current) => {
        if (editingTemplate) {
          return current.map((template) =>
            template.id === saved.id ? saved : template
          );
        }

        return [...current, saved];
      });

      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error saving template", err);
      alert(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (template: AiTemplate) => {
    setEditingTemplate(template);
    setFormState(templateToForm(template));
    setIsDialogOpen(true);
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
        const error = await response.json();
        throw new Error(error.error || "Failed to delete template");
      }

      setTemplates((current) =>
        current.filter((existing) => existing.id !== template.id)
      );
    } catch (err) {
      console.error("Error deleting template", err);
      alert(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage AI templates to tailor summaries for technical and non-technical readers.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load templates</CardTitle>
            <CardDescription className="text-destructive/80">
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardFooter>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No templates yet</CardTitle>
            <CardDescription>
              Create templates to influence how commits and overviews are phrased.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setIsDialogOpen(true)}>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>
                      Audience: {template.audience}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(template)}
                    >
                      <PencilIcon className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(template)}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {template.description && (
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Commit prompt
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">
                    {template.commitPrompt}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Overall prompt
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">
                    {template.overallPrompt}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Example summaries
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {template.examples.commitExamples.map((example, index) => (
                      <li
                        key={`${template.id}-example-${index}`}
                        className="rounded-md border bg-muted/40 p-3"
                      >
                        <p className="font-medium">{example.title}</p>
                        <p className="text-muted-foreground">{example.summary}</p>
                      </li>
                    ))}
                  </ul>
                  {template.examples.overallExample && (
                    <blockquote className="mt-3 rounded-md border-l-4 border-primary/40 bg-muted/30 p-3 text-sm text-muted-foreground">
                      {template.examples.overallExample}
                    </blockquote>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {describeTemplateForPreview(template)}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Provide instructions and examples so the AI can mirror your preferred tone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Executive briefing"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Short summary of when to use this template"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-audience">Audience</Label>
              <Input
                id="template-audience"
                value={formState.audience}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    audience: event.target.value,
                  }))
                }
                placeholder="Technical, Non-technical, Product leadership..."
              />
              <p className="text-xs text-muted-foreground">
                Use "Technical" for engineers or "Non-technical" for stakeholder recaps.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="commit-prompt">Commit prompt</Label>
              <Textarea
                id="commit-prompt"
                value={formState.commitPrompt}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    commitPrompt: event.target.value,
                  }))
                }
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="overall-prompt">Overall prompt</Label>
              <Textarea
                id="overall-prompt"
                value={formState.overallPrompt}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    overallPrompt: event.target.value,
                  }))
                }
                rows={4}
              />
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Commit examples</p>
                  <p className="text-xs text-muted-foreground">
                    Provide realistic summaries so the AI mirrors the tone.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddExample}>
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add example
                </Button>
              </div>
              <div className="space-y-4">
                {formState.commitExamples.map((example, index) => (
                  <div
                    key={`example-${index}`}
                    className="space-y-3 rounded-lg border bg-muted/40 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Example {index + 1}</p>
                      {formState.commitExamples.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveExample(index)}
                        >
                          <TrashIcon className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Commit theme"
                      value={example.title}
                      onChange={(event) => updateExample(index, "title", event.target.value)}
                    />
                    <Textarea
                      placeholder="How should the AI summarize this change?"
                      value={example.summary}
                      onChange={(event) => updateExample(index, "summary", event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="overall-example">Overall example</Label>
              <Textarea
                id="overall-example"
                value={formState.overallExample}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    overallExample: event.target.value,
                  }))
                }
                placeholder="Optional intro example for the overall summary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
