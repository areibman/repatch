"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AiTemplate } from "@/types/ai-template";
import { Loader2Icon, PencilIcon, TrashIcon } from "lucide-react";

interface TemplateFormState {
  name: string;
  description: string;
  audience: "technical" | "non-technical" | "balanced";
  commitPrompt: string;
  overallPrompt: string;
  exampleInput: string;
  exampleOutput: string;
}

const emptyFormState: TemplateFormState = {
  name: "",
  description: "",
  audience: "balanced",
  commitPrompt: "",
  overallPrompt: "",
  exampleInput: "",
  exampleOutput: "",
};

export default function TemplateSettingsPage() {
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<TemplateFormState>(emptyFormState);
  const [editingTemplate, setEditingTemplate] = useState<AiTemplate | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/templates");
        if (!response.ok) {
          throw new Error("Failed to fetch templates");
        }
        const data = await response.json();
        setTemplates(data);
      } catch (error) {
        console.error("Error fetching templates", error);
        setError(
          error instanceof Error ? error.message : "Unable to load templates"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const resetForm = () => {
    setFormState(emptyFormState);
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (template: AiTemplate) => {
    setEditingTemplate(template);
    setFormState({
      name: template.name,
      description: template.description ?? "",
      audience: template.audience,
      commitPrompt: template.commitPrompt,
      overallPrompt: template.overallPrompt,
      exampleInput: template.exampleInput ?? "",
      exampleOutput: template.exampleOutput ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (template: AiTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) {
      return;
    }

    setDeleteBusyId(template.id);
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Failed to delete template");
      }

      setTemplates((previous) => previous.filter((item) => item.id !== template.id));
    } catch (error) {
      console.error("Error deleting template", error);
      alert(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleFormChange = <K extends keyof TemplateFormState>(
    key: K,
    value: TemplateFormState[K]
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const hasExample = useMemo(
    () =>
      Boolean(
        formState.exampleInput.trim() && formState.exampleOutput.trim()
      ),
    [formState.exampleInput, formState.exampleOutput]
  );

  const submitTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.name.trim() || !formState.commitPrompt.trim() || !formState.overallPrompt.trim()) {
      alert("Name, commit prompt, and overall prompt are required.");
      return;
    }

    setIsSaving(true);

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || null,
      audience: formState.audience,
      commitPrompt: formState.commitPrompt.trim(),
      overallPrompt: formState.overallPrompt.trim(),
      exampleInput: formState.exampleInput.trim() || null,
      exampleOutput: formState.exampleOutput.trim() || null,
    };

    try {
      if (editingTemplate) {
        const response = await fetch(`/api/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update template");
        }

        const updated = await response.json();
        setTemplates((previous) =>
          previous.map((item) => (item.id === editingTemplate.id ? updated : item))
        );
      } else {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create template");
        }

        const created = await response.json();
        setTemplates((previous) => [...previous, created]);
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving template", error);
      alert(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AI Templates</h1>
          <p className="text-muted-foreground">
            Create reusable prompts that steer technical and non-technical summaries.
          </p>
        </div>
        <Button onClick={openCreateDialog}>New Template</Button>
      </header>

      <Separator />

      {isLoading ? (
        <div className="flex items-center justify-center rounded-md border border-dashed p-12 text-muted-foreground">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" /> Loading templates...
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <p className="font-medium">No templates yet</p>
          <p className="mt-1 text-sm">Create your first template to guide AI patch notes.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="flex h-full flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>{template.name}</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {template.audience}
                  </span>
                </CardTitle>
                {template.description ? (
                  <CardDescription>{template.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 text-sm">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Commit Prompt
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {template.commitPrompt}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Patch Note Prompt
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {template.overallPrompt}
                  </p>
                </div>
                {template.exampleInput && template.exampleOutput ? (
                  <div className="grid gap-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Example Input
                      </h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {template.exampleInput}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Example Output
                      </h4>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {template.exampleOutput}
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(template.updatedAt).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(template)}
                  >
                    <PencilIcon className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={deleteBusyId === template.id}
                    onClick={() => handleDelete(template)}
                  >
                    {deleteBusyId === template.id ? (
                      <>
                        <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="mr-1 h-4 w-4" /> Delete
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <form onSubmit={submitTemplate} className="space-y-6">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit template" : "Create template"}</DialogTitle>
              <DialogDescription>
                Configure prompts and examples to tailor summaries for different audiences.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={formState.name}
                  onChange={(event) => handleFormChange("name", event.target.value)}
                  placeholder="Product Marketing"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-audience">Audience</Label>
                <Select
                  value={formState.audience}
                  onValueChange={(value) =>
                    handleFormChange(
                      "audience",
                      value as TemplateFormState["audience"]
                    )
                  }
                >
                  <SelectTrigger id="template-audience">
                    <SelectValue placeholder="Choose audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="non-technical">Non-technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={formState.description}
                onChange={(event) => handleFormChange("description", event.target.value)}
                placeholder="Short blurb about when to use this template"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-commit">Commit prompt</Label>
              <Textarea
                id="template-commit"
                value={formState.commitPrompt}
                onChange={(event) => handleFormChange("commitPrompt", event.target.value)}
                placeholder="How should commits be summarized?"
                rows={4}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-overall">Patch note prompt</Label>
              <Textarea
                id="template-overall"
                value={formState.overallPrompt}
                onChange={(event) => handleFormChange("overallPrompt", event.target.value)}
                placeholder="How should the final patch note read?"
                rows={5}
                required
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template-example-input">Example input</Label>
                <Textarea
                  id="template-example-input"
                  value={formState.exampleInput}
                  onChange={(event) => handleFormChange("exampleInput", event.target.value)}
                  placeholder="Commit summaries + stats that illustrate expectations"
                  rows={5}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-example-output">Example output</Label>
                <Textarea
                  id="template-example-output"
                  value={formState.exampleOutput}
                  onChange={(event) => handleFormChange("exampleOutput", event.target.value)}
                  placeholder="Markdown patch note matching your desired style"
                  rows={5}
                />
              </div>
            </div>

            {hasExample ? (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-semibold text-foreground">Example preview</p>
                <p className="text-xs uppercase tracking-wide">Input</p>
                <p className="whitespace-pre-wrap text-sm">{formState.exampleInput}</p>
                <Separator className="my-3" />
                <p className="text-xs uppercase tracking-wide">Output</p>
                <p className="whitespace-pre-wrap text-sm">{formState.exampleOutput}</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingTemplate ? (
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
  );
}
