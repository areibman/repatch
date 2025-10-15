"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AiTemplate, TemplateExample } from "@/types/ai-template";

interface TemplateFormState {
  name: string;
  description: string;
  narrativeType: string;
  commitPrompt: string;
  overallPrompt: string;
  examples: TemplateExample[];
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  description: "",
  narrativeType: "technical",
  commitPrompt: "",
  overallPrompt: "",
  examples: [
    {
      title: "",
      input: "",
      output: "",
    },
  ],
};

export default function TemplateSettingsPage() {
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TemplateFormState>(EMPTY_FORM);

  const isEditing = useMemo(() => Boolean(activeTemplateId), [activeTemplateId]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/ai-templates");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load templates");
        }
        const data = await response.json();
        setTemplates(
          data.map((template: any) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            narrativeType: template.narrative_type,
            commitPrompt: template.commit_prompt,
            overallPrompt: template.overall_prompt,
            examples: Array.isArray(template.examples) ? template.examples : [],
            createdAt: template.created_at,
            updatedAt: template.updated_at,
          }))
        );
      } catch (error) {
        console.error("Failed to fetch templates", error);
        setError(error instanceof Error ? error.message : "Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const resetForm = () => {
    setActiveTemplateId(null);
    setFormState(EMPTY_FORM);
  };

  const handleExampleChange = (
    index: number,
    field: keyof TemplateExample,
    value: string
  ) => {
    setFormState((prev) => {
      const nextExamples = [...prev.examples];
      nextExamples[index] = {
        ...nextExamples[index],
        [field]: value,
      } as TemplateExample;
      return {
        ...prev,
        examples: nextExamples,
      };
    });
  };

  const addExample = () => {
    setFormState((prev) => ({
      ...prev,
      examples: [
        ...prev.examples,
        { title: "", input: "", output: "" },
      ],
    }));
  };

  const removeExample = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      examples:
        prev.examples.length > 1
          ? prev.examples.filter((_, i) => i !== index)
          : prev.examples,
    }));
  };

  const handleEdit = (template: AiTemplate) => {
    setActiveTemplateId(template.id);
    setFormState({
      name: template.name,
      description: template.description ?? "",
      narrativeType: template.narrativeType,
      commitPrompt: template.commitPrompt,
      overallPrompt: template.overallPrompt,
      examples:
        template.examples.length > 0
          ? template.examples
          : [{ title: "", input: "", output: "" }],
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formState.name,
        description: formState.description || undefined,
        narrativeType: formState.narrativeType,
        commitPrompt: formState.commitPrompt,
        overallPrompt: formState.overallPrompt,
        examples: formState.examples.filter(
          (example) => example.title || example.input || example.output
        ),
      };

      const response = await fetch(
        activeTemplateId ? `/api/ai-templates/${activeTemplateId}` : "/api/ai-templates",
        {
          method: activeTemplateId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save template");
      }

      const savedTemplate = await response.json();

      setTemplates((prev) => {
        if (activeTemplateId) {
          return prev.map((template) =>
            template.id === activeTemplateId
              ? {
                  id: savedTemplate.id,
                  name: savedTemplate.name,
                  description: savedTemplate.description,
                  narrativeType: savedTemplate.narrative_type,
                  commitPrompt: savedTemplate.commit_prompt,
                  overallPrompt: savedTemplate.overall_prompt,
                  examples: Array.isArray(savedTemplate.examples)
                    ? savedTemplate.examples
                    : [],
                  createdAt: savedTemplate.created_at,
                  updatedAt: savedTemplate.updated_at,
                }
              : template
          );
        }

        return [
          ...prev,
          {
            id: savedTemplate.id,
            name: savedTemplate.name,
            description: savedTemplate.description,
            narrativeType: savedTemplate.narrative_type,
            commitPrompt: savedTemplate.commit_prompt,
            overallPrompt: savedTemplate.overall_prompt,
            examples: Array.isArray(savedTemplate.examples)
              ? savedTemplate.examples
              : [],
            createdAt: savedTemplate.created_at,
            updatedAt: savedTemplate.updated_at,
          },
        ];
      });

      resetForm();
    } catch (error) {
      console.error("Failed to save template", error);
      alert(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: AiTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) {
      return;
    }

    try {
      setDeleting(template.id);
      const response = await fetch(`/api/ai-templates/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete template");
      }

      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      if (activeTemplateId === template.id) {
        resetForm();
      }
    } catch (error) {
      console.error("Failed to delete template", error);
      alert(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold">AI Templates</h1>
        <p className="text-muted-foreground mt-2">
          Control the prompts and examples that guide patch note summaries.
          Use different tones for technical digests, leadership briefs, or any
          custom narrative.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? "Edit template" : "Create template"}</CardTitle>
            <CardDescription>
              Provide prompts and sample outputs to steer the summarizer.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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
                  placeholder="Leadership Brief"
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
                  rows={2}
                  placeholder="Explain who this template is for."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="template-tone">Narrative Type</Label>
                <Input
                  id="template-tone"
                  value={formState.narrativeType}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      narrativeType: event.target.value,
                    }))
                  }
                  placeholder="technical | non-technical | mixed"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="commit-prompt">Commit Prompt</Label>
                <Textarea
                  id="commit-prompt"
                  value={formState.commitPrompt}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      commitPrompt: event.target.value,
                    }))
                  }
                  rows={6}
                  placeholder="Instructions for individual commit summaries. Use placeholders like {{commit_message}} and {{diff}}."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="overall-prompt">Overall Prompt</Label>
                <Textarea
                  id="overall-prompt"
                  value={formState.overallPrompt}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      overallPrompt: event.target.value,
                    }))
                  }
                  rows={6}
                  placeholder="Instructions for the overall summary. Use placeholders like {{repo_name}} and {{commit_summaries}}."
                  required
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Examples</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addExample}>
                    Add example
                  </Button>
                </div>

                <div className="space-y-4">
                  {formState.examples.map((example, index) => (
                    <Card key={index} className="border-dashed">
                      <CardHeader className="py-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold">
                            Example {index + 1}
                          </CardTitle>
                          {formState.examples.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeExample(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor={`example-title-${index}`}>Title</Label>
                          <Input
                            id={`example-title-${index}`}
                            value={example.title}
                            onChange={(event) =>
                              handleExampleChange(index, "title", event.target.value)
                            }
                            placeholder="Short label for this example"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`example-input-${index}`}>Input</Label>
                          <Textarea
                            id={`example-input-${index}`}
                            value={example.input}
                            onChange={(event) =>
                              handleExampleChange(index, "input", event.target.value)
                            }
                            rows={3}
                            placeholder="Describe the commit or situation"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`example-output-${index}`}>Output</Label>
                          <Textarea
                            id={`example-output-${index}`}
                            value={example.output}
                            onChange={(event) =>
                              handleExampleChange(index, "output", event.target.value)
                            }
                            rows={3}
                            placeholder="Show the style of summary you expect"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              {isEditing ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Templates are reused across patch notes.
                </span>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : isEditing ? "Save changes" : "Create template"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available templates</CardTitle>
              <CardDescription>
                Preview tone, examples, and manage your library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading templates...</p>
              ) : error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates yet. Create your first template using the form.
                </p>
              ) : (
                <div className="space-y-4" data-testid="template-list">
                  {templates.map((template) => (
                    <Card key={template.id} className="border-muted/60">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <CardDescription>{template.narrativeType}</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(template)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(template)}
                              disabled={deleting === template.id}
                            >
                              {deleting === template.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {template.description && (
                          <p className="text-sm text-muted-foreground">
                            {template.description}
                          </p>
                        )}
                        {template.examples.length > 0 && (
                          <div className="space-y-2">
                            {template.examples.map((example, index) => (
                              <div
                                key={`${template.id}-example-${index}`}
                                className="rounded-md border border-dashed p-3"
                              >
                                <p className="text-xs font-semibold text-muted-foreground">
                                  Example {index + 1}: {example.title}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Input: {example.input}
                                </p>
                                <p className="mt-1 text-xs">Output: {example.output}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
