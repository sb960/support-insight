"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface InputFormProps {
  onSubmit: (message: string) => Promise<void>;
  isLoading: boolean;
  title?: string;
  hint?: string;
  submitLabel?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export function InputForm({
  onSubmit,
  isLoading,
  title = "Submit test ticket",
  hint,
  submitLabel = "Submit ticket",
  disabled = false,
  disabledMessage,
}: InputFormProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    await onSubmit(message);
    setMessage("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardHeader>
      <CardContent>
        {disabledMessage ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {disabledMessage}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Paste a customer support message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-32"
            disabled={isLoading || disabled}
          />
          <Button type="submit" disabled={isLoading || disabled || !message.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
