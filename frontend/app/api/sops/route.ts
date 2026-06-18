import { NextRequest, NextResponse } from "next/server";

import { backendAuthHeaders } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
    try {
        const tag = request.nextUrl.searchParams.get("tag");
        const url = tag
            ? `${FASTAPI_URL}/api/sops?tag=${encodeURIComponent(tag)}`
            : `${FASTAPI_URL}/api/sops`;

        const response = await fetch(url, {
            headers: backendAuthHeaders(request),
        });

        if (!response.ok) {
            throw new Error("Failed to fetch SOPs");
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("SOP list proxy error:", error);
        return NextResponse.json({ error: "Failed to fetch SOPs" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const response = await fetch(`${FASTAPI_URL}/api/sops`, {
            method: "POST",
            headers: backendAuthHeaders(request),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("SOP create error:", errorText);
            return NextResponse.json({ error: "Failed to create SOP" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error("SOP create proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
