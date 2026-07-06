import { NextRequest, NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
    try {
        const ip = getClientIp(request);
        const response = await fetch(`${FASTAPI_URL}/api/demo/remaining`, {
            headers: { "X-Forwarded-For": ip },
        });

        if (!response.ok) {
            return NextResponse.json({ remaining: 3, limit: 3 });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ remaining: 3, limit: 3 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIp(request);
        const body = await request.json();

        const response = await fetch(`${FASTAPI_URL}/api/demo/triage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Forwarded-For": ip,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => ({}));
        const remaining = response.headers.get("x-ratelimit-remaining");

        const res = NextResponse.json(
            {
                ...data,
                rate_limit_remaining:
                    data.rate_limit_remaining ??
                    (remaining !== null ? Number(remaining) : undefined),
            },
            { status: response.status },
        );

        if (remaining !== null) {
            res.headers.set("X-RateLimit-Remaining", remaining);
        }

        return res;
    } catch (error) {
        console.error("Demo triage proxy error:", error);
        return NextResponse.json({ error: "Demo triage failed" }, { status: 500 });
    }
}
