import { NextRequest, NextResponse } from "next/server";

import { resolveIngestApiKey } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
    try {
        const apiKey = resolveIngestApiKey(request);
        if (!apiKey) {
            return NextResponse.json(
                {
                    error:
                        "No ingest API key configured. Log in or register a workspace first, or set INGEST_API_KEY in frontend .env.local.",
                },
                { status: 401 },
            );
        }

        const body = await request.json();

        const response = await fetch(`${FASTAPI_URL}/api/tickets/ingest`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("FastAPI ingest error:", errorText);
            return NextResponse.json(
                { error: "Failed to ingest ticket" },
                { status: response.status },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Ingest proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
