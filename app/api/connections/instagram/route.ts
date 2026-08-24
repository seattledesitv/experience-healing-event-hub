import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Instagram Login API uses its own access token and graph.instagram.com host.
  // Keep the legacy META_ACCESS_TOKEN fallback temporarily so older environments
  // can still validate while we migrate fully to the Instagram Login flow.
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const version = process.env.META_GRAPH_API_VERSION || "v26.0";

  if (!token || !accountId) {
    return NextResponse.json({
      connected: false,
      error: "Instagram access token or Instagram account ID is not configured.",
    }, { status: 400 });
  }

  const url = new URL(`https://graph.instagram.com/${version}/${accountId}`);
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.error?.message || "Instagram connection validation failed.",
      code: payload?.error?.code || null,
      type: payload?.error?.type || null,
    }, { status: response.status });
  }

  return NextResponse.json({
    connected: true,
    account: {
      id: payload.id || accountId,
      username: payload.username || null,
      name: payload.name || null,
    },
    apiVersion: version,
    authMode: "instagram_login",
  });
}
