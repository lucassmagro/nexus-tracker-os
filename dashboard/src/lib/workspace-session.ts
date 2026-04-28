"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("active_workspace_id")?.value;
  
  if (workspaceId) return workspaceId;

  // Fallback to first available workspace if none selected
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get the primary workspace for the user
  const { data: userData } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("auth_uid", user.id)
    .single();

  return userData?.workspace_id || null;
}

export async function setActiveWorkspaceAction(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set("active_workspace_id", workspaceId, { 
    path: "/", 
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === "production"
  });
  redirect("/");
}

export async function getUserWorkspaces() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*");

  return workspaces || [];
}

