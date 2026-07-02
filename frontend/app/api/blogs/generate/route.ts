import { NextRequest, NextResponse } from "next/server";

import { resolveIngestApiKey } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
    try {
        const apiKey = resolveIngestApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ error: "Missing ingest API key." }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(`${FASTAPI_URL}/api/blogs/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => ({}));
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Blog generate proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}