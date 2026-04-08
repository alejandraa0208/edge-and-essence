import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COMING_SOON_PATHS = ["/coming-soon"];
const BYPASS_TOKEN = process.env.PREVIEW_TOKEN ?? "gio-preview";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("preview_token")?.value;
  const queryToken = request.nextUrl.searchParams.get("preview");

  // If they pass ?preview=gio-preview in the URL, set the cookie and let them through
  if (queryToken === BYPASS_TOKEN) {
    const response = NextResponse.next();
    response.cookies.set("preview_token", BYPASS_TOKEN, { maxAge: 60 * 60 * 24 * 7 }); // 7 days
    return response;
  }

  // If they have the cookie, let them through
  if (token === BYPASS_TOKEN) {
    return NextResponse.next();
  }

  // Allow coming-soon page through always
  if (COMING_SOON_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Everyone else gets redirected to coming soon
  return NextResponse.redirect(new URL("/coming-soon", request.url));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};