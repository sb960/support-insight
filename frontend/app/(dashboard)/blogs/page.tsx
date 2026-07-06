"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Pencil, RefreshCw } from "lucide-react";

import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Textarea } from "@/components/ui/textarea";

type BlogDraft = {
    id: string;
    tenant_id: string;
    topic: string;
    target_audience?: string | null;
    title?: string | null;
    slug?: string | null;
    body_markdown?: string | null;
    excerpt?: string | null;
    seo_keywords?: string[];
    status: "processing" | "pending_review" | "published" | "failed";
    created_at?: string;
    published_at?: string | null;
    cms_url?: string | null;
};

function formatDate(value?: string | null) {
    if (!value) return "—";
    const hasTz = /([zZ]|[+\-]\d{2}:\d{2})$/.test(value);
    const date = new Date(hasTz ? value : `${value}Z`);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function BlogsPage() {
    const [drafts, setDrafts] = useState<BlogDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [topic, setTopic] = useState("");
    const [targetAudience, setTargetAudience] = useState("");

    const [selectedDraft, setSelectedDraft] = useState<BlogDraft | null>(null);
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [bodyMarkdown, setBodyMarkdown] = useState("");
    const [excerpt, setExcerpt] = useState("");
    const [seoKeywords, setSeoKeywords] = useState("");

    const selectedDraftKeywords = useMemo(
        () => selectedDraft?.seo_keywords?.join(", ") ?? "",
        [selectedDraft],
    );

    useEffect(() => {
        if (!selectedDraft) return;
        setTitle(selectedDraft.title ?? "");
        setSlug(selectedDraft.slug ?? "");
        setBodyMarkdown(selectedDraft.body_markdown ?? "");
        setExcerpt(selectedDraft.excerpt ?? "");
        setSeoKeywords(selectedDraftKeywords);
    }, [selectedDraft, selectedDraftKeywords]);

    const fetchDrafts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/blogs/drafts");
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error ?? "Failed to load blog drafts");
            }
            setDrafts(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load blog drafts");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, []);

    const startGeneration = async () => {
        if (!topic.trim()) {
            setError("Topic is required.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch("/api/blogs/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: topic.trim(),
                    target_audience: targetAudience.trim() || undefined,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error ?? data?.detail ?? "Failed to start generation");
            }
            setTopic("");
            setTargetAudience("");
            await fetchDrafts();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start generation");
        } finally {
            setSubmitting(false);
        }
    };

    const openDraft = (draft: BlogDraft) => {
        setSelectedDraft(draft);
    };

    const closeDraft = () => setSelectedDraft(null);

    const saveDraft = async () => {
        if (!selectedDraft) return;

        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/blogs/${selectedDraft.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim() || undefined,
                    slug: slug.trim() || undefined,
                    body_markdown: bodyMarkdown,
                    excerpt: excerpt.trim() || undefined,
                    seo_keywords: seoKeywords
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error ?? data?.detail ?? "Failed to save draft");
            }
            setSelectedDraft(data);
            await fetchDrafts();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save draft");
        } finally {
            setSubmitting(false);
        }
    };

    const publishDraft = async () => {
        if (!selectedDraft) return;

        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`/api/blogs/${selectedDraft.id}/publish`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim() || selectedDraft.title,
                    slug: slug.trim() || selectedDraft.slug,
                    body_markdown: bodyMarkdown,
                    excerpt: excerpt.trim() || selectedDraft.excerpt,
                    seo_keywords: seoKeywords
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    target_audience: selectedDraft.target_audience,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error ?? data?.detail ?? "Failed to publish draft");
            }
            setSelectedDraft(data);
            await fetchDrafts();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to publish draft");
        } finally {
            setSubmitting(false);
        }
    };

    const statusBadge = (status: BlogDraft["status"]) => {
        switch (status) {
            case "processing":
                return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Processing</Badge>;
            case "pending_review":
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Pending Review</Badge>;
            case "published":
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Published</Badge>;
            case "failed":
                return <Badge variant="destructive">Failed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <>
            <TopNav title="Blogs" description="Generate and publish tenant-scoped blog drafts." />
            <Container className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Generate Blog Draft
                            </CardTitle>
                            <CardDescription>
                                Kick off the native background generation pipeline.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium">Topic</label>
                                <Input
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="Passive Safety Systems in Advanced Coolants"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium">Target audience</label>
                                <Input
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    placeholder="Engineering managers, technical buyers"
                                />
                            </div>
                            <div className="sm:col-span-2 flex gap-3">
                                <Button onClick={startGeneration} disabled={submitting}>
                                    {submitting ? "Starting..." : "Generate Draft"}
                                </Button>
                                <Button onClick={fetchDrafts} variant="outline" disabled={loading}>
                                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Workflow</CardTitle>
                            <CardDescription>Track the lifecycle of each draft.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                Generation stores the draft in MongoDB.
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-blue-500" />
                                Pending review opens the editor sheet.
                            </div>
                            <div className="flex items-center gap-2">
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                                Publish saves the final approved content.
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="rounded-md border bg-card shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Topic</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                        Loading blog drafts...
                                    </TableCell>
                                </TableRow>
                            ) : drafts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                        No blog drafts yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                drafts.map((draft) => (
                                    <TableRow key={draft.id}>
                                        <TableCell className="max-w-xs truncate">{draft.topic}</TableCell>
                                        <TableCell className="max-w-xs truncate">{draft.title ?? "Untitled"}</TableCell>
                                        <TableCell>{statusBadge(draft.status)}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                            {formatDate(draft.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => openDraft(draft)}>
                                                Open
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Sheet open={!!selectedDraft} onOpenChange={(open) => !open && closeDraft()}>
                    {selectedDraft && (
                        <SheetContent className="w-[100vw] overflow-y-auto sm:max-w-3xl">
                            <SheetHeader>
                                <SheetTitle>Edit Blog Draft</SheetTitle>
                                <SheetDescription>
                                    Review, refine, and publish the generated content.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="mt-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Title</label>
                                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Slug</label>
                                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Excerpt</label>
                                    <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Body</label>
                                    <Textarea
                                        value={bodyMarkdown}
                                        onChange={(e) => setBodyMarkdown(e.target.value)}
                                        rows={10}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Preview</label>
                                    <div className="rounded-md border bg-muted/30 p-4 min-h-[12rem]">
                                        <MarkdownContent content={bodyMarkdown} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">SEO Keywords</label>
                                    <Input
                                        value={seoKeywords}
                                        onChange={(e) => setSeoKeywords(e.target.value)}
                                        placeholder="coolants, passive safety, manufacturing"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button onClick={saveDraft} disabled={submitting} className="flex-1">
                                        Save Draft
                                    </Button>
                                    <Button
                                        onClick={publishDraft}
                                        disabled={submitting || selectedDraft.status === "published"}
                                        className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        Approve & Publish
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    )}
                </Sheet>
            </Container>
        </>
    );
}