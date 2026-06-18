import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, clearIngestApiKeyCookie, setIngestApiKeyCookie } from "@/lib/server-auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const response = await fetch(`${FASTAPI_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const data = await response.json();
        const res = NextResponse.json({ ok: true });
        res.cookies.set("auth_token", data.access_token, authCookieOptions);
        setIngestApiKeyCookie(res, data.ingest_api_key);
        return res;
    } catch (error) {
        console.error("Login proxy error:", error);
        return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
}

export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth_token", "", { httpOnly: true, path: "/", maxAge: 0 });
    clearIngestApiKeyCookie(res);
    return res;
}
