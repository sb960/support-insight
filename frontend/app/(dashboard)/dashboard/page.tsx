"use client";

import { useState } from "react";

import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import { HistoryTable } from "@/components/ui/HistoryTable";
import { InputForm } from "@/components/ui/InputForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardOverviewPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

    const handleIngest = async (message: string) => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/tickets/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to submit ticket");
            }

            setSuccessMessage("Ticket submitted for processing.");
            setHistoryRefreshKey((k) => k + 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <TopNav
                title="Overview"
                description="Submit test tickets and monitor your support queue."
            />
            <Container className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Workspace</CardDescription>
                            <CardTitle className="text-base">Support queue</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Tickets ingested via webhook or the form below appear in your tenant
                            queue.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Agent actions</CardDescription>
                            <CardTitle className="text-base">Review & resolve</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Open the Tickets page to audit AI drafts, check SOP compliance, and
                            approve replies.
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Policies</CardDescription>
                            <CardTitle className="text-base">SOP library</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            Manage operating procedures that guide AI triage for your organization.
                        </CardContent>
                    </Card>
                </div>

                <InputForm onSubmit={handleIngest} isLoading={isLoading} />

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {successMessage}
                    </div>
                )}

                <HistoryTable refreshKey={historyRefreshKey} />
            </Container>
        </>
    );
}
