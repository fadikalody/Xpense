import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh user session if it exists
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is not logged in and trying to access an authenticated route, redirect to /login
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/register");
  
  // Authenticated section is root and /scan, /history, /budgets, /api/ (except /api/process-receipt which we can protect as well)
  // Let's protect everything except auth routes, static files, and sw.js
  const isStaticFile =
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/icons") ||
    path.startsWith("/manifest.json") ||
    path.startsWith("/sw.js") ||
    path.startsWith("/favicon.ico");

  if (!user && !isAuthRoute && !isStaticFile) {
    // Redirect to login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is logged in and trying to access auth pages, redirect to dashboard (/)
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
