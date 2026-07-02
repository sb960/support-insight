import { NextRequest, NextResponse } from "next/server";

import { backendAuthHeaders } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ draftId: string }> },
) {
    try {
        const { draftId } = await params;
        const body = await request.json();

        const response = await fetch(`${FASTAPI_URL}/api/blogs/drafts/${draftId}`, {
            method: "PATCH",
            headers: backendAuthHeaders(request),
            body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => ({}));
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Blog draft patch proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}