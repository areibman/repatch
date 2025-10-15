"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon, PlusIcon } from "lucide-react";
import type { AiTemplate, AiTemplateExampleCommit } from "@/types/ai-template";
import {
  DEFAULT_TEMPLATE_EXAMPLES,
  formatTemplateAudience,
} from "@/lib/templates";

interface TemplateFormState {
  id?: string;
  name: string;
  description: string;
  audience: string;
  commitPrompt: string;
  overallPrompt: string;
  sectionHeading: string;
  overview: string;
  commitExamples: AiTemplateExampleCommit[];
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  description: "",
  audience: "technical",
  commitPrompt: "",
  overallPrompt: "",
  sectionHeading: DEFAULT_TEMPLATE_EXAMPLES.sectionHeading || "Key Changes",
  overview: "",
  commitExamples: [
    { title: "", summary: "" },
    { title: "", summary: "" },
  ],
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

  const previewExamples = useMemo(
    () => formState.commitExamples.filter((example) => example.summary.trim()),
    [formState.commitExamples]
  );

  const openCreateDialog = () => {
    setFormState(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: AiTemplate) => {
    setFormState({
      id: template.id,
      name: template.name,
      description: template.description || "",
      audience: template.audience || "technical",
      commitPrompt: template.commitPrompt,
      overallPrompt: template.overallPrompt,
      sectionHeading:
        template.examples.sectionHeading || DEFAULT_TEMPLATE_EXAMPLES.sectionHeading || "Key Changes",
      overview: template.examples.overview || "",
      commitExamples:
        template.examples.commits && template.examples.commits.length > 0
          ? template.examples.commits.map((example) => ({
              title: example.title || "",
              summary: example.summary,
            }))
          : [{ title: "", summary: "" }],
    });
    setIsDialogOpen(true);
  };

  const resetDialog = () => {
    setIsDialogOpen(false);
    setFormState(EMPTY_FORM);
    setIsSubmitting(false);
  };

  const handleExampleChange = (index: number, field: "title" | "summary", value: string) => {
    setFormState((prev) => {
      const updated = [...prev.commitExamples];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return {
        ...prev,
        commitExamples: updated,
      };
    });
  };

  const addExample = () => {
    setFormState((prev) => ({
      ...prev,
      commitExamples: [...prev.commitExamples, { title: "", summary: "" }],
    }));
  };

  const removeExample = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      commitExamples: prev.commitExamples.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.name.trim()) {
      alert("Template name is required");
      return;
    }

    if (!formState.commitPrompt.trim() || !formState.overallPrompt.trim()) {
      alert("Both prompts are required");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || undefined,
      audience: formState.audience,
      commitPrompt: formState.commitPrompt.trim(),
      overallPrompt: formState.overallPrompt.trim(),
      examples: {
        sectionHeading: formState.sectionHeading.trim() || DEFAULT_TEMPLATE_EXAMPLES.sectionHeading,
        overview: formState.overview.trim(),
        commits: formState.commitExamples
          .filter((example) => example.summary.trim())
          .map((example) => ({
            title: example.title.trim() || undefined,
            summary: example.summary.trim(),
          })),
      },
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
            Craft reusable prompts that tailor AI-generated patch notes.
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
            <DialogContent className="sm:max-w-[680px]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <DialogHeader>
                  <DialogTitle>
                    {formState.id ? "Edit template" : "Create template"}
                  </DialogTitle>
                  <DialogDescription>
                    Provide guidance and examples so the AI mirrors your preferred tone.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
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
                      required
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
                      placeholder="Short note about the intended audience or tone"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="template-audience">Audience</Label>
                    <Select
                      value={formState.audience}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          audience: value,
                        }))
                      }
                    >
                      <SelectTrigger id="template-audience">
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="non-technical">Non-technical</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
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
                      placeholder="Explain how individual commits should be summarized."
                      rows={4}
                      required
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
                      placeholder="Describe the tone and focus for the opening summary."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="section-heading">Section heading</Label>
                    <Input
                      id="section-heading"
                      value={formState.sectionHeading}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          sectionHeading: event.target.value,
                        }))
                      }
                      placeholder="Key Changes"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="overview-example">Overview example</Label>
                    <Textarea
                      id="overview-example"
                      value={formState.overview}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          overview: event.target.value,
                        }))
                      }
                      placeholder="Example intro paragraph that mirrors the desired voice"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Commit examples</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addExample}
                      >
                        Add example
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      {formState.commitExamples.map((example, index) => (
                        <Card key={index} className="border-muted/60">
                          <CardContent className="space-y-3 pt-4">
                            <div className="grid gap-2">
                              <Label htmlFor={`example-title-${index}`}>Title</Label>
                              <Input
                                id={`example-title-${index}`}
                                value={example.title || ""}
                                onChange={(event) =>
                                  handleExampleChange(index, "title", event.target.value)
                                }
                                placeholder="Caching upgrade"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`example-summary-${index}`}>Summary</Label>
                              <Textarea
                                id={`example-summary-${index}`}
                                value={example.summary}
                                onChange={(event) =>
                                  handleExampleChange(index, "summary", event.target.value)
                                }
                                placeholder="Cut API latency by optimizing cache hydration."
                                rows={2}
                              />
                            </div>
                            {formState.commitExamples.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                className="self-start"
                                onClick={() => removeExample(index)}
                              >
                                Remove example
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border bg-muted/30 p-4 text-sm">
                    <h3 className="mb-1 text-sm font-semibold">Preview</h3>
                    <p className="text-xs text-muted-foreground">
                      The first two examples are shown below. Additional examples are still saved.
                    </p>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        {formState.sectionHeading || DEFAULT_TEMPLATE_EXAMPLES.sectionHeading}
                      </p>
                      {formState.overview && <p>{formState.overview}</p>}
                      {previewExamples.length ? (
                        <ul className="list-disc space-y-1 pl-5">
                          {previewExamples.slice(0, 2).map((example, index) => (
                            <li key={`${example.summary}-${index}`}>
                              {example.title ? (
                                <span className="font-medium">{example.title}: </span>
                              ) : null}
                              {example.summary}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Provide at least one example summary to help the AI mimic the tone.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
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
              Start by creating a template that matches the tone you need for patch notes.
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>
                      {template.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {formatTemplateAudience(template.audience)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Commit prompt
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-snug">
                    {template.commitPrompt}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Overall prompt
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-snug">
                    {template.overallPrompt}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {template.examples.sectionHeading || DEFAULT_TEMPLATE_EXAMPLES.sectionHeading}
                  </p>
                  {template.examples.overview && (
                    <p className="mt-1 leading-snug">{template.examples.overview}</p>
                  )}
                  {template.examples.commits?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {template.examples.commits.slice(0, 2).map((example, index) => (
                        <li key={`${template.id}-${index}`}>
                          {example.title ? (
                            <span className="font-medium">{example.title}: </span>
                          ) : null}
                          {example.summary}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No example summaries provided.
                    </p>
                  )}
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
