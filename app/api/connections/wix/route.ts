import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;

  if (!apiKey || !siteId) {
    return NextResponse.json({
      connected: false,
      error: "Wix credentials are not fully configured in the environment.",
    }, { status: 400 });
  }

  const response = await fetch("https://www.wixapis.com/events/v3/events/query", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: apiKey,
      "wix-site-id": siteId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        paging: {
          limit: 1,
          offset: 0,
        },
      },
      includeDrafts: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({
      connected: false,
      error: payload?.message || payload?.details?.applicationError?.description || `Wix returned ${response.status}.`,
      status: response.status,
    }, { status: response.status });
  }

  return NextResponse.json({
    connected: true,
    site: {
      id: siteId,
    },
    eventsVisible: Array.isArray(payload?.events) ? payload.events.length : 0,
  });
}
