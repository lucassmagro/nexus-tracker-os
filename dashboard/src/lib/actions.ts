"use server";

import { createClient } from "./supabase-server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function createWorkspaceAction(formData: FormData) {
  console.log("[createWorkspaceAction] Starting workspace creation process...");
  const name = formData.get("name") as string;
  const shopifyUrl = formData.get("shopifyUrl") as string;

  if (!name) return { error: "Workspace name is required" };

  const supabase = await createClient(); 
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[createWorkspaceAction] Unauthorized - No user found");
    return { error: "Unauthorized" };
  }
  console.log(`[createWorkspaceAction] Authenticated as user ID: ${user.id}`);

  // Create a strict service role client for bypassing RLS during user creation
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 0. Ensure the user exists in public.users first to avoid RLS conflicts down the line
  console.log("[createWorkspaceAction] Checking if user exists in public.users...");
  const { data: existingUser } = await adminSupabase
    .from("users")
    .select("id")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!existingUser) {
    console.log("[createWorkspaceAction] User not found. Creating user record with service_role...");
    const { error: initialUserError } = await adminSupabase
      .from("users")
      .insert({
        auth_uid: user.id,
        email: user.email!,
        role: "owner"
      });
    if (initialUserError) {
      console.error("[createWorkspaceAction] Failed to insert into Users table:", initialUserError);
      return { error: "Failed to initialize user profile: " + initialUserError.message };
    }
    console.log("[createWorkspaceAction] User created successfully.");
  } else {
    console.log("[createWorkspaceAction] User exists.");
  }

  // 1. Create Workspace
  console.log("[createWorkspaceAction] Attempting to insert into Workspaces table...");
  const { data: workspace, error: wsError } = await adminSupabase
    .from("workspaces")
    .insert({
      name,
      shopify_store_url: shopifyUrl || null,
      shopify_webhook_secret: crypto.randomUUID(),
    })
    .select()
    .single();

  if (wsError) {
    console.error("[createWorkspaceAction] Failed to insert into Workspaces table:", wsError);
    return { error: wsError.message };
  }
  console.log(`[createWorkspaceAction] Workspace created successfully with ID: ${workspace.id}`);

  // 2. Link User to Workspace as Owner
  console.log("[createWorkspaceAction] Updating public.users to link workspace_id...");
  const { error: userError } = await adminSupabase
    .from("users")
    .update({
      workspace_id: workspace.id,
      role: "owner",
    })
    .eq("auth_uid", user.id);

  if (userError) {
    console.error("[createWorkspaceAction] Failed to update Users table:", userError);
    await adminSupabase.from("workspaces").delete().eq("id", workspace.id);
    return { error: userError.message };
  }
  console.log("[createWorkspaceAction] User successfully linked to workspace.");

  // 3. Set the active workspace cookie so the dashboard persists session
  const cookieStore = await cookies();
  cookieStore.set("active_workspace_id", workspace.id, { path: "/" });
  console.log("[createWorkspaceAction] Active workspace cookie set.");

  revalidatePath("/", "layout");
  return { success: true, workspace };
}

export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Credenciais inválidas ou usuário não encontrado." };
  }

  return { success: true };
}

export async function signUpAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3001');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function resetShopifySecretAction(workspaceId: string) {
    const supabase = await createClient();
    const newSecret = crypto.randomUUID();
    
    const { error } = await supabase
      .from("workspaces")
      .update({ shopify_webhook_secret: newSecret })
      .eq("id", workspaceId);
      
    if (error) return { error: error.message };
    
    revalidatePath("/settings");
    return { success: true, newSecret };
}
