"use client";

import React, { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Clock, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

import Container from "@/components/container";
import { TopNav } from "@/components/nav";

interface TicketDocument {
    _id: string;
    raw_message: string;
    category: string;
    priority: string;
    draft_reply?: string;
    reasoning?: string;
    is_sop_compliant: boolean;
    confidence_score: number;
    sop_rules_followed: string[];
    status: string;
    created_at: string;
    internal_notes?: string;
}

export default function AgentWorkspace() {
    const [tickets, setTickets] = useState<TicketDocument[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<TicketDocument | null>(null);
    const [editableDraft, setEditableDraft] = useState<string>("");
    const [internalNotes, setInternalNotes] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/history");
            if (!res.ok) throw new Error("Failed to fetch tickets database array");
            const data = await res.json();
            const normalized = (Array.isArray(data) ? data : []).map((item) => ({
                ...item,
                _id: item._id ?? item.id,
                raw_message: item.raw_message ?? item.original_message,
            }));
            setTickets(normalized);
        } catch (error) {
            console.error("Error hydrating dashboard:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (selectedTicket) {
            setEditableDraft(selectedTicket.draft_reply || "");
            setInternalNotes(selectedTicket.internal_notes || "");
        }
    }, [selectedTicket]);

    const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: newStatus,
                    draft_reply: editableDraft,
                    internal_notes: internalNotes || undefined,
                }),
            });

            if (!response.ok) throw new Error("Failed to mutate ticket state machine");

            setSelectedTicket(null);
            await fetchTickets();
        } catch (error) {
            console.error("Action surface submission error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Auto-Drafted":
                return (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Auto-Drafted</Badge>
                );
            case "Escalated (Non-Compliant)":
            case "Escalated (Low Confidence)":
            case "Escalated (Manual)":
                return <Badge variant="destructive">Escalated</Badge>;
            case "Pending (AI Timeout)":
            case "Pending (AI Failed)":
                return (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Pending Warning</Badge>
                );
            case "Resolved":
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Resolved</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getConfidenceBadge = (score: number) => {
        const percentage = Math.round(score * 100);
        if (score >= 0.85) {
            return (
                <span className="inline-flex items-center text-emerald-600 font-medium">
                    {percentage}% (High)
                </span>
            );
        }
        if (score >= 0.7) {
            return (
                <span className="inline-flex items-center text-amber-600 font-medium">
                    {percentage}% (Mid)
                </span>
            );
        }
        return (
            <span className="inline-flex items-center text-rose-600 font-medium">
                {percentage}% (Low)
            </span>
        );
    };

    function formatLocalDateTime(isoString?: string) {
        if (!isoString) return "—";
        const hasTZ = /([zZ]|[+\-]\d{2}:\d{2})$/.test(isoString);
        const iso = hasTZ ? isoString : `${isoString}Z`;
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatLocalTime(isoString?: string) {
        if (!isoString) return "—";
        const hasTZ = /([zZ]|[+\-]\d{2}:\d{2})$/.test(isoString);
        const date = new Date(hasTZ ? isoString : `${isoString}Z`);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }

    return (
        <>
            <TopNav
                title="Agent Workspace"
                description="Monitor inbound requests, trace compliance, and approve AI drafts."
            />
            <Container className="space-y-6">
                <div className="flex justify-end">
                    <Button onClick={fetchTickets} variant="outline" size="icon" disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>

                <div className="rounded-md border bg-card shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Ticket ID</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Confidence Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Received</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        Loading tickets...
                                    </TableCell>
                                </TableRow>
                            ) : tickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No active customer support tickets found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tickets.map((ticket) => (
                                    <TableRow
                                        key={ticket._id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => setSelectedTicket(ticket)}
                                    >
                                        <TableCell className="font-mono text-xs font-semibold">
                                            #
                                            {ticket._id
                                                ? ticket._id.substring(ticket._id.length - 6).toUpperCase()
                                                : "UNKNOWN"}
                                        </TableCell>
                                        <TableCell className="capitalize">{ticket.category}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    ticket.priority === "High" ? "destructive" : "secondary"
                                                }
                                            >
                                                {ticket.priority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{getConfidenceBadge(ticket.confidence_score)}</TableCell>
                                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                        <TableCell className="text-right font-medium text-muted-foreground">
                                            {formatLocalTime(ticket.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
                    {selectedTicket && (
                        <SheetContent className="w-[100vw] sm:max-w-2xl overflow-y-auto space-y-6">
                            <SheetHeader className="border-b pb-4">
                                <div className="flex items-center gap-3">
                                    <SheetTitle>Ticket Audit & Resolution</SheetTitle>
                                    <Badge variant="outline" className="capitalize">
                                        {selectedTicket.category}
                                    </Badge>
                                </div>
                                <SheetDescription>
                                    Received at {formatLocalDateTime(selectedTicket.created_at)}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                    Raw Customer Message
                                </h3>
                                <div className="p-4 bg-muted/50 rounded-lg border text-sm whitespace-pre-wrap">
                                    {selectedTicket.raw_message}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                    SOP Compliance Audit Trail
                                </h3>
                                <div className="p-4 bg-muted/50 rounded-lg border text-sm space-y-3">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <span className="text-muted-foreground">System Assessment Rule:</span>
                                        <span className="inline-flex items-center gap-1.5 font-semibold">
                                            {selectedTicket.is_sop_compliant ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    SOP compliant
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                    Manual review required
                                                </>
                                            )}
                                        </span>
                                    </div>
                                    {selectedTicket.sop_rules_followed &&
                                    selectedTicket.sop_rules_followed.length > 0 ? (
                                        <ul className="space-y-1.5">
                                            {selectedTicket.sop_rules_followed.map((rule, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-xs">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span>{rule}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> No SOP audit records compiled.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold">Suggested Draft Reply</h3>
                                <Textarea
                                    value={editableDraft}
                                    onChange={(e) => setEditableDraft(e.target.value)}
                                    rows={8}
                                    placeholder="Write or edit customer response text here..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Internal Notes
                                </label>
                                <Textarea
                                    value={internalNotes}
                                    onChange={(e) => setInternalNotes(e.target.value)}
                                    rows={2}
                                    className="text-xs bg-muted/50"
                                    placeholder="Add audit context before saving..."
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t">
                                <Button
                                    onClick={() => handleUpdateStatus(selectedTicket._id, "Resolved")}
                                    disabled={isSubmitting}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    Approve & Send
                                </Button>
                                <Button
                                    onClick={() =>
                                        handleUpdateStatus(selectedTicket._id, "Escalated (Manual)")
                                    }
                                    disabled={isSubmitting}
                                    variant="destructive"
                                    className="flex-1"
                                >
                                    Escalate to Manager
                                </Button>
                            </div>
                        </SheetContent>
                    )}
                </Sheet>
            </Container>
        </>
    );
}
