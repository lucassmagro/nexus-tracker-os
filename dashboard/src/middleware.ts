import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Apply Security Headers for Production Hardening
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value }) =>
            response.cookies.set(name, value)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Protect dashboard routes
  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/signup");
  const isWorkspacesPage = request.nextUrl.pathname.startsWith("/workspaces");
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isSettingsPage = request.nextUrl.pathname.startsWith("/settings");

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    // 2. Check if user has a workspace and get role
    const { data: userData } = await supabase
      .from("users")
      .select("workspace_id, role")
      .eq("auth_uid", user.id)
      .single();

    const role = userData?.role || "viewer";
    
    // Check cookie first
    const activeWorkspaceId = request.cookies.get("active_workspace_id")?.value;
    const hasWorkspace = !!activeWorkspaceId || !!userData?.workspace_id;

    // Route protections
    if (isAuthPage) {
      return NextResponse.redirect(new URL(hasWorkspace ? "/" : "/workspaces", request.url));
    }

    if (!hasWorkspace && !isWorkspacesPage) {
      return NextResponse.redirect(new URL("/workspaces", request.url));
    }

    if (isAdminPage && role !== "super_admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isSettingsPage && role !== "owner" && role !== "super_admin" && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
