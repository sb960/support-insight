import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, setIngestApiKeyCookie } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const response = await fetch(`${FASTAPI_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message =
                typeof data?.detail === "string"
                    ? data.detail
                    : "Registration failed";
            return NextResponse.json({ error: message }, { status: response.status });
        }

        const res = NextResponse.json({
            ok: true,
            tenant_id: data.tenant_id,
            ingest_api_key: data.ingest_api_key,
        });
        res.cookies.set("auth_token", data.access_token, authCookieOptions);
        setIngestApiKeyCookie(res, data.ingest_api_key);
        return res;
    } catch (error) {
        console.error("Register proxy error:", error);
        return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }
}
