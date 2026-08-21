import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const version = process.env.META_GRAPH_API_VERSION || "v25.0";

  if (!token || !accountId) {
    return NextResponse.json({
      connected: false,
      error: "Instagram credentials are not fully configured in the environment.",
    }, { status: 400 });
  }

  const url = new URL(`https://graph.facebook.com/${version}/${accountId}`);
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.error?.message || "Instagram connection validation failed.",
      code: payload?.error?.code || null,
    }, { status: response.status });
  }

  return NextResponse.json({
    connected: true,
    account: {
      id: payload.id,
      username: payload.username || null,
      name: payload.name || null,
    },
    apiVersion: version,
  });
}
