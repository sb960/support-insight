import { NextRequest } from "next/server";

const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
};

export function backendAuthHeaders(request: NextRequest): HeadersInit {
    const token = request.cookies.get("auth_token")?.value;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

export function resolveIngestApiKey(request: NextRequest): string | undefined {
    return request.cookies.get("ingest_api_key")?.value || process.env.INGEST_API_KEY || undefined;
}

export function setIngestApiKeyCookie(
    response: { cookies: { set: (name: string, value: string, options: typeof COOKIE_OPTS) => void } },
    apiKey?: string | null,
) {
    if (apiKey) {
        response.cookies.set("ingest_api_key", apiKey, COOKIE_OPTS);
    }
}

export function clearIngestApiKeyCookie(
    response: { cookies: { set: (name: string, value: string, options: { httpOnly: boolean; path: string; maxAge: number }) => void } },
) {
    response.cookies.set("ingest_api_key", "", { httpOnly: true, path: "/", maxAge: 0 });
}

export { COOKIE_OPTS as authCookieOptions };
