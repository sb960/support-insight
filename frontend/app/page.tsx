"use client";

import { useState } from "react";
import { InputForm } from "@/components/ui/InputForm";
import { HistoryTable } from "@/components/ui/HistoryTable";

export default function Home() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

    const handleAnalyze = async (message: string) => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/tickets/ingest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to submit ticket");
            }

            setSuccessMessage("Ticket submitted for processing. Check the queue below.");
            setHistoryRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
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

                {successMessage && (
                    <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-emerald-700 dark:text-emerald-300 mb-6">
                        {successMessage}
                    </div>
                )}

                <HistoryTable refreshKey={historyRefreshKey} />
            </div>
        </main>
    );
}
