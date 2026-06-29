import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const sessionToken = request.cookies.get("auth_token")?.value;
    const pathname = request.nextUrl.pathname;
    const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

    const isProtectedWorkspace =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/tickets") ||
        pathname.startsWith("/sop");

    if (isProtectedWorkspace && !sessionToken) {
        return NextResponse.redirect(new URL("/register", request.url));
    }

    if (isAuthPage && sessionToken) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/tickets/:path*", "/sop/:path*", "/login", "/register"],
};
