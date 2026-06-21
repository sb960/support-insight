import { NextRequest, NextResponse } from "next/server";

import { backendAuthHeaders } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> },
) {
    try {
        const { ticketId } = await params;
        const body = await request.json();

        const response = await fetch(`${FASTAPI_URL}/api/tickets/${ticketId}`, {
            method: "PATCH",
            headers: backendAuthHeaders(request),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Ticket update error:", errorText);
            return NextResponse.json(
                { error: "Failed to update ticket" },
                { status: response.status },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Ticket PATCH proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
