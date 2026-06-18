import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Pull the session cookie flag safely (adjust cookie name depending on auth provider)
  const sessionToken = request.cookies.get("next-auth.session-token")?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  // Define array of load-bearing routes we need shielded
  const isProtectedWorkspace = 
    request.nextUrl.pathname.startsWith("/tickets") || 
    request.nextUrl.pathname.startsWith("/sops");

  console.log("isProtectedWorkspace", isProtectedWorkspace);
  console.log("sessionToken", sessionToken);  
  console.log("isAuthPage", isAuthPage);
  console.log("request.url", request.url);
  console.log("request.nextUrl.pathname", request.nextUrl.pathname);
  console.log("request.nextUrl.pathname.startsWith('/tickets')", request.nextUrl.pathname.startsWith("/tickets"));
  console.log("request.nextUrl.pathname.startsWith('/sops')", request.nextUrl.pathname.startsWith("/sops"));
  console.log("request.nextUrl.pathname.startsWith('/login')", request.nextUrl.pathname.startsWith("/login"));
  console.log("request.nextUrl.pathname.startsWith('/logout')", request.nextUrl.pathname.startsWith("/logout"));
  console.log("request.nextUrl.pathname.startsWith('/profile')", request.nextUrl.pathname.startsWith("/profile"));
  console.log("request.nextUrl.pathname.startsWith('/settings')", request.nextUrl.pathname.startsWith("/settings"));
  console.log("request.nextUrl.pathname.startsWith('/help')", request.nextUrl.pathname.startsWith("/help"));
  if (isProtectedWorkspace && !sessionToken) {
    // Redirect unauthenticated anonymous users back to login screen cleanly
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && sessionToken) {
    // If already logged in, redirect away from the login page straight to workspace
    return NextResponse.redirect(new URL("/tickets", request.url));
  }

  return NextResponse.next();
}

// 🧠 Optimizing performance: Only run middleware on our core workspace views
export const config = {
  matcher: ["/tickets/:path*", "/sops/:path*", "/login"],
};