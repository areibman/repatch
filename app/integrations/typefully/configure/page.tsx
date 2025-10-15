"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";

export default function TypefullyConfigurePage() {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  useEffect(() => {
    // Check if there's an existing configuration
    const checkConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/integrations/typefully/config");
        if (response.ok) {
          const data = await response.json();
          if (data.configured) {
            setHasExistingConfig(true);
            // Don't show the actual API key for security
            setApiKey("••••••••••••••••");
          }
        }
      } catch (error) {
        console.error("Failed to check config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkConfig();
  }, []);

  const onSave = async () => {
    if (!apiKey || apiKey === "••••••••••••••••") {
      alert("Please enter a valid API key");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/integrations/typefully/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save configuration");
      }

      alert("✅ Typefully configuration saved successfully!");
      setHasExistingConfig(true);
    } catch (error) {
      console.error("Save error:", error);
      alert(
        `❌ Error: ${
          error instanceof Error ? error.message : "Failed to save configuration"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Are you sure you want to remove the Typefully integration?")) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/integrations/typefully/config", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete configuration");
      }

      alert("✅ Typefully configuration removed successfully!");
      setApiKey("");
      setHasExistingConfig(false);
    } catch (error) {
      console.error("Delete error:", error);
      alert(
        `❌ Error: ${
          error instanceof Error ? error.message : "Failed to delete configuration"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/typefully" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Typefully</CardTitle>
          <CardDescription>
            Provide your Typefully API key to enable Twitter thread queueing.
            You can find your API key in your Typefully account settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="tfapi_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your API key from{" "}
              <a
                href="https://typefully.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Typefully Settings
              </a>
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <div>
            {hasExistingConfig && (
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isSaving}
              >
                Remove Integration
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/integrations">Cancel</Link>
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
