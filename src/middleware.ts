import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow these through
  if (
    pathname.startsWith("/coming-soon") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.png"
  ) {
    return NextResponse.next();
  }

  // Secret preview path — visiting this sets the cookie
  if (pathname === "/preview-gio") {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("preview_token", "gio-preview", {
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  // Check for preview cookie
  const token = request.cookies.get("preview_token")?.value;
  if (token === "gio-preview") {
    return NextResponse.next();
  }

  // Everyone else sees coming soon
  return NextResponse.redirect(new URL("/coming-soon", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};