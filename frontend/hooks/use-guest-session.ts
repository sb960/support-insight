"use client";

import { useCallback, useEffect, useState } from "react";

import type { GuestTicket } from "@/lib/demo-data";

const TICKETS_KEY = "supportinsight_demo_tickets";

export function useGuestSession() {
    const [tickets, setTickets] = useState<GuestTicket[]>([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(TICKETS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setTickets(parsed);
                }
            }
        } catch {
            sessionStorage.removeItem(TICKETS_KEY);
        }
        setHydrated(true);
    }, []);

    const persist = useCallback((next: GuestTicket[]) => {
        setTickets(next);
        sessionStorage.setItem(TICKETS_KEY, JSON.stringify(next));
    }, []);

    const addTicket = useCallback(
        (ticket: Omit<GuestTicket, "id" | "created_at">) => {
            const entry: GuestTicket = {
                ...ticket,
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
            };
            persist([entry, ...tickets]);
            return entry;
        },
        [persist, tickets],
    );

    const updateTicket = useCallback(
        (id: string, patch: Partial<GuestTicket>) => {
            persist(tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)));
        },
        [persist, tickets],
    );

    const clearTickets = useCallback(() => {
        persist([]);
    }, [persist]);

    return { tickets, hydrated, addTicket, updateTicket, clearTickets };
}
