"use client";

import { useState } from "react";
import { InputForm } from "@/components/ui/InputForm";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async (message: string) => {
    setIsLoading(true);
    console.log("Analyzing:", message);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto py-10 px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">SupportInsight</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          AI-powered customer support triage dashboard
        </p>
        <InputForm onAnalyze={handleAnalyze} isLoading={isLoading} />
      </div>
    </main>
  );
}