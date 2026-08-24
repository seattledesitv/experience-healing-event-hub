import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const version = process.env.META_GRAPH_API_VERSION || "v26.0";

  if (!token || !pageId) {
    return NextResponse.json({
      connected: false,
      error: "Facebook Page ID or Page access token is not configured.",
    }, { status: 400 });
  }

  const url = new URL(`https://graph.facebook.com/${version}/${pageId}`);
  url.searchParams.set("fields", "id,name,link,instagram_business_account{id,username,name}");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.error?.message || "Facebook Page connection validation failed.",
      code: payload?.error?.code || null,
    }, { status: response.status });
  }

  return NextResponse.json({
    connected: true,
    page: {
      id: payload.id,
      name: payload.name || null,
      link: payload.link || null,
    },
    instagramAccount: payload.instagram_business_account
      ? {
          id: payload.instagram_business_account.id,
          username: payload.instagram_business_account.username || null,
          name: payload.instagram_business_account.name || null,
        }
      : null,
    apiVersion: version,
  });
}
