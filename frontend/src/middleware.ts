import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const sessionToken = request.cookies.get("auth_token")?.value;
    const pathname = request.nextUrl.pathname;
    const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

    const isProtectedWorkspace =
        pathname.startsWith("/tickets") || pathname.startsWith("/sop");

    if (isProtectedWorkspace && !sessionToken) {
        const loginUrl = new URL("/register", request.url);
        return NextResponse.redirect(loginUrl);
    }

    if (isAuthPage && sessionToken) {
        return NextResponse.redirect(new URL("/tickets", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/tickets/:path*", "/sop/:path*", "/login", "/register"],
};
