import { NextRequest, NextResponse } from "next/server";

import { backendAuthHeaders } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
    try {
        const response = await fetch(`${FASTAPI_URL}/api/blogs/drafts`, {
            headers: backendAuthHeaders(request),
        });

        const data = await response.json().catch(() => ({}));
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Blog drafts proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}