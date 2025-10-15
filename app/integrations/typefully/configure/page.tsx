"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/16/solid";
import { createClient } from "@/lib/supabase/client";

export default function TypefullyConfigurePage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingConfig, setExistingConfig] = useState<any>(null);

  useEffect(() => {
    // Load existing configuration if any
    const loadConfig = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("typefully_configs")
        .select("*")
        .single();
      
      if (data && !error) {
        setExistingConfig(data);
        setApiKey(data.api_key);
      }
      setIsLoading(false);
    };
    
    loadConfig();
  }, []);

  const onSave = async () => {
    if (!apiKey) {
      alert("Please enter your Typefully API key");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      
      if (existingConfig) {
        // Update existing config
        const { error } = await supabase
          .from("typefully_configs")
          .update({ api_key: apiKey })
          .eq("id", existingConfig.id);
        
        if (error) throw error;
      } else {
        // Create new config
        const { error } = await supabase
          .from("typefully_configs")
          .insert({ api_key: apiKey });
        
        if (error) throw error;
      }

      alert("Typefully configuration saved successfully!");
      router.push("/integrations");
    } catch (error) {
      console.error("Error saving Typefully config:", error);
      alert("Failed to save configuration. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading configuration...</p>
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
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="typefully_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              You can find your API key in your{" "}
              <a
                href="https://typefully.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Typefully settings
              </a>
              .
            </p>
          </div>
          
          {existingConfig && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircleIcon className="h-4 w-4" />
              <span>Typefully is already connected</span>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : existingConfig ? "Update" : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Instructions Card */}
      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle>Getting Started with Typefully</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="font-medium text-sm mb-1">1. Get your API Key</h3>
            <p className="text-sm text-muted-foreground">
              Navigate to your Typefully settings and generate an API key.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-sm mb-1">2. Connect your Twitter account</h3>
            <p className="text-sm text-muted-foreground">
              Make sure you have connected your Twitter account to Typefully.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-sm mb-1">3. Queue threads from patch notes</h3>
            <p className="text-sm text-muted-foreground">
              Once configured, you can queue Twitter threads directly from your patch note pages.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}