import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AccessRole = "pending" | "admin" | "super_admin";

export async function requireApprovedUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: access } = await supabase
    .from("user_access")
    .select("role,display_name,email")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!access || access.role === "pending") redirect("/pending-approval");
  return { user: data.user, access: access as { role: AccessRole; display_name: string | null; email: string | null } };
}

export async function requireSuperAdmin() {
  const result = await requireApprovedUser();
  if (result.access.role !== "super_admin") redirect("/dashboard");
  return result;
}
