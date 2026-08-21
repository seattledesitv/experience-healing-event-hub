import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ connected: false, error: "LinkedIn access token is not configured." }, { status: 400 });
  }

  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.message || payload?.error_description || `LinkedIn returned ${response.status}.`,
      status: response.status,
    }, { status: response.status });
  }

  if (!payload.sub) {
    return NextResponse.json({ connected: false, error: "LinkedIn did not return the authenticated member ID." }, { status: 502 });
  }

  return NextResponse.json({
    connected: true,
    member: {
      id: payload.sub,
      urn: `urn:li:person:${payload.sub}`,
      name: payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(" ") || null,
      email: payload.email || null,
      picture: payload.picture || null,
    },
  });
}
