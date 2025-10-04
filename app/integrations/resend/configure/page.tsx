"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function ResendConfigurePage() {
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const onSave = async () => {
    // TODO: Persist to your backend or Supabase as needed
    console.log("Save Resend config", { apiKey, fromEmail });
    alert("Saved Resend configuration (mock)");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/integrations/resend" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Resend</CardTitle>
          <CardDescription>
            Provide your Resend API key and default sender email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder="re_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">From Email</label>
            <Input
              type="email"
              placeholder="Patch Notes <patch@yourdomain.com>"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href="/integrations">Cancel</Link>
          </Button>
          <Button onClick={onSave}>Save</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
