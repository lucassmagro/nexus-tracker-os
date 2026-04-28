import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Apply Security Headers for Production Hardening
  const applyHeaders = (res: NextResponse) => {
    res.headers.set('X-DNS-Prefetch-Control', 'on');
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.headers.set('X-Frame-Options', 'SAMEORIGIN');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    res.headers.set('X-XSS-Protection', '1; mode=block');
  };

  applyHeaders(response);

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
          applyHeaders(response);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Helper to redirect while preserving cookies and headers
  const redirect = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const redirectResponse = NextResponse.redirect(url);
    
    // Copy cookies from our manipulated response
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    // Copy headers
    applyHeaders(redirectResponse);
    return redirectResponse;
  };

  // 1. Protect dashboard routes
  const isAuthPage = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/signup");
  const isWorkspacesPage = request.nextUrl.pathname.startsWith("/workspaces");
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isSettingsPage = request.nextUrl.pathname.startsWith("/settings");

  if (!user && !isAuthPage) {
    return redirect("/login");
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
      return redirect(hasWorkspace ? "/" : "/workspaces");
    }

    if (!hasWorkspace && !isWorkspacesPage) {
      return redirect("/workspaces");
    }

    if (isAdminPage && role !== "super_admin") {
      return redirect("/");
    }

    if (isSettingsPage && role !== "owner" && role !== "super_admin" && role !== "admin") {
      return redirect("/");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
