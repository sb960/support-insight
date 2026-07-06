"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    ShieldCheck,
    Ticket,
    Webhook,
} from "lucide-react";

import Container from "@/components/container";
import { ThemeToggle } from "@/components/theme-toggle";
import { InputForm } from "@/components/ui/InputForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaticBlogPreview } from "@/components/landing/static-blog-preview";
import { DemoQueue } from "@/components/landing/demo-queue";
import { siteConfig } from "@/config/site";
import { useGuestSession } from "@/hooks/use-guest-session";
import { DEFAULT_DEMO_SOPS } from "@/lib/demo-data";

export function LandingPage() {
    const { tickets, hydrated, addTicket } = useGuestSession();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [limit, setLimit] = useState(3);
    const [lastResultId, setLastResultId] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/demo/triage")
            .then((r) => r.json())
            .then((data) => {
                if (typeof data.remaining === "number") setRemaining(data.remaining);
                if (typeof data.limit === "number") setLimit(data.limit);
            })
            .catch(() => setRemaining(3));
    }, []);

    const demoDisabled = remaining === 0;

    const handleDemoSubmit = async (message: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/demo/triage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, sops: DEFAULT_DEMO_SOPS }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    setRemaining(0);
                    throw new Error(
                        data.detail ??
                            `Demo limit reached (${limit} tries per 24 hours). Create a workspace to continue.`,
                    );
                }
                throw new Error(data.detail ?? data.error ?? "Demo triage failed");
            }

            if (typeof data.rate_limit_remaining === "number") {
                setRemaining(data.rate_limit_remaining);
            }

            const entry = addTicket({
                original_message: data.original_message,
                category: data.category,
                priority: data.priority,
                draft_reply: data.draft_reply,
                reasoning: data.reasoning,
                is_sop_compliant: data.is_sop_compliant,
                confidence_score: data.confidence_score,
                sop_rules_followed: data.sop_rules_followed ?? [],
                status: data.status,
                internal_notes: data.internal_notes,
            });
            setLastResultId(entry.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const lastTicket = tickets.find((t) => t.id === lastResultId) ?? tickets[0];

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Container className="flex items-center justify-between py-4">
                    <span className="font-semibold tracking-tight">{siteConfig.name}</span>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" asChild>
                            <Link href="/login">Sign in</Link>
                        </Button>
                        <Button asChild>
                            <Link href="/register">Create workspace</Link>
                        </Button>
                    </div>
                </Container>
            </header>

            <main>
                <Container className="py-12 md:py-16 space-y-16">
                    <section className="max-w-3xl space-y-6">
                        <Badge variant="secondary" className="w-fit">
                            Demo mode — nothing is saved until you sign up
                        </Badge>
                        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                            AI support triage that follows your SOPs
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            {siteConfig.description}. Try real triage below — results stay in your
                            browser. Create a workspace to save tickets, manage SOPs, and connect
                            webhooks.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button size="lg" asChild>
                                <Link href="/register">
                                    Start free workspace
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild>
                                <Link href="#try">Try a ticket</Link>
                            </Button>
                        </div>
                    </section>

                    <section className="grid gap-4 md:grid-cols-3">
                        {[
                            {
                                icon: Webhook,
                                title: "Ingest",
                                desc: "Webhooks or test form — customer messages enter your queue.",
                            },
                            {
                                icon: ShieldCheck,
                                title: "Triage",
                                desc: "AI classifies, drafts replies, and checks SOP compliance.",
                            },
                            {
                                icon: Ticket,
                                title: "Review",
                                desc: "Agents approve, edit, or escalate before anything is sent.",
                            },
                        ].map((step) => (
                            <Card key={step.title}>
                                <CardHeader className="pb-2">
                                    <step.icon className="h-5 w-5 text-muted-foreground mb-2" />
                                    <CardTitle className="text-base">{step.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    {step.desc}
                                </CardContent>
                            </Card>
                        ))}
                    </section>

                    <section id="try" className="grid gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <InputForm
                                title="Try a test ticket"
                                hint={
                                    remaining !== null
                                        ? `${remaining} of ${limit} free tries remaining today (per IP)`
                                        : "Loading demo quota…"
                                }
                                onSubmit={handleDemoSubmit}
                                isLoading={isLoading}
                                disabled={demoDisabled}
                                disabledMessage={
                                    demoDisabled
                                        ? `You've used all ${limit} demo tries for today. Create a workspace for unlimited triage with saved history.`
                                        : undefined
                                }
                                submitLabel="Analyze message"
                            />
                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                                    {error}
                                    {demoDisabled && (
                                        <div className="mt-3">
                                            <Button size="sm" asChild>
                                                <Link href="/register">Create workspace</Link>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {lastTicket ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Latest result</CardTitle>
                                    <CardDescription>
                                        Same pipeline as production — stored locally only
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge>{lastTicket.category}</Badge>
                                        <Badge variant="secondary">{lastTicket.priority}</Badge>
                                        <Badge
                                            variant={
                                                lastTicket.status === "Escalated"
                                                    ? "destructive"
                                                    : "outline"
                                            }
                                        >
                                            {lastTicket.status}
                                        </Badge>
                                        <Badge variant="outline">
                                            {Math.round(lastTicket.confidence_score * 100)}%
                                            confidence
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="font-medium mb-1">Customer message</p>
                                        <p className="text-muted-foreground whitespace-pre-wrap rounded-md border p-3 bg-muted/30">
                                            {lastTicket.original_message}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-medium mb-1">Draft reply</p>
                                        <p className="text-muted-foreground whitespace-pre-wrap rounded-md border p-3 bg-muted/30">
                                            {lastTicket.draft_reply}
                                        </p>
                                    </div>
                                    {lastTicket.sop_rules_followed.length > 0 && (
                                        <ul className="space-y-1">
                                            {lastTicket.sop_rules_followed.map((rule) => (
                                                <li
                                                    key={rule}
                                                    className="flex items-start gap-2 text-xs"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                    {rule}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="flex items-center justify-center min-h-[200px]">
                                <CardContent className="text-center text-muted-foreground text-sm">
                                    Submit a message to see AI triage results here.
                                </CardContent>
                            </Card>
                        )}
                    </section>

                    {hydrated && tickets.length > 0 && <DemoQueue tickets={tickets} />}

                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-2xl font-semibold tracking-tight">
                                Blog generation preview
                            </h2>
                        </div>
                        <p className="text-muted-foreground max-w-2xl">
                            Signed-in workspaces generate help-center articles from{" "}
                            <strong>your</strong> SOPs and resolved tickets. Here&apos;s a static
                            example — no API calls on the public site.
                        </p>
                        <StaticBlogPreview />
                    </section>

                    <section className="rounded-xl border bg-muted/30 p-8 text-center space-y-4">
                        <ArrowRight className="h-8 w-8 mx-auto text-muted-foreground" />
                        <h2 className="text-2xl font-semibold">Ready to save your queue?</h2>
                        <p className="text-muted-foreground max-w-lg mx-auto">
                            Register your company workspace for persistent tickets, SOP management,
                            webhook ingest keys, and full agent tools.
                        </p>
                        <Button size="lg" asChild>
                            <Link href="/register">Create workspace — it&apos;s free to try</Link>
                        </Button>
                    </section>
                </Container>
            </main>
        </div>
    );
}
