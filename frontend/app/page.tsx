"use client";

import { useState } from "react";
import { InputForm } from "@/components/ui/InputForm";
import { AnalysisCard } from "@/components/ui/AnalysisCard";
import { HistoryTable } from "@/components/ui/HistoryTable";

interface AnalysisResult {
  category: string;
  priority: string;
  draft_reply: string;
  reasoning?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const runAnalysis = async (message: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze message");
      }

      const data = await response.json();
      setResult(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async (message: string) => {
    setLastMessage(message);
    const ok = await runAnalysis(message);
    if (ok) setHistoryRefreshKey((k) => k + 1);
  };

  const handleRegenerate = async () => {
    if (!lastMessage) return;
    const ok = await runAnalysis(lastMessage);
    if (ok) setHistoryRefreshKey((k) => k + 1);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto py-10 px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">SupportInsight</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI-powered customer support triage dashboard
        </p>

        <InputForm onAnalyze={handleAnalyze} isLoading={isLoading} />

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
            Error: {error}
          </div>
        )}

        {result && (
          <AnalysisCard
            category={result.category}
            priority={result.priority}
            draftReply={result.draft_reply}
            reasoning={result.reasoning}
            onRegenerate={handleRegenerate}
          />
        )}

        <HistoryTable refreshKey={historyRefreshKey} />
      </div>
    </main>
  );
}
