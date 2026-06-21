import { NextRequest, NextResponse } from "next/server";

import { backendAuthHeaders } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ sopId: string }> },
) {
    try {
        const { sopId } = await params;
        const body = await request.json();

        const response = await fetch(`${FASTAPI_URL}/api/sops/${sopId}`, {
            method: "PUT",
            headers: backendAuthHeaders(request),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("SOP update error:", errorText);
            return NextResponse.json({ error: "Failed to update SOP" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("SOP PUT proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ sopId: string }> },
) {
    try {
        const { sopId } = await params;

        const response = await fetch(`${FASTAPI_URL}/api/sops/${sopId}`, {
            method: "DELETE",
            headers: backendAuthHeaders(request),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("SOP delete error:", errorText);
            return NextResponse.json({ error: "Failed to delete SOP" }, { status: response.status });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("SOP DELETE proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
