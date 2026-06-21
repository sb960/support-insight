import { NextRequest, NextResponse } from "next/server";

import { backendAuthHeaders } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get("category");
        const priority = searchParams.get("priority");
        const search = searchParams.get("search");

        const params = new URLSearchParams();
        if (category) params.append("category", category);
        if (priority) params.append("priority", priority);
        if (search) params.append("search", search);

        const queryString = params.toString();
        const url = `${FASTAPI_URL}/history${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
            headers: backendAuthHeaders(request),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: errorBody?.detail ?? "Failed to fetch history" },
                { status: response.status },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("History proxy error:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}
