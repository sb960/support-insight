"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface InputFormProps {
  onAnalyze: (message: string) => Promise<void>;
  isLoading: boolean;
}

export function InputForm({ onAnalyze, isLoading }: InputFormProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    await onAnalyze(message);
    setMessage("");
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Analyze Customer Message</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Paste a customer support message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-32"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !message.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Message"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
