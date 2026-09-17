import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;
  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;

  if (!clientId || !clientSecret || !refreshToken || !accountId || !locationId) {
    return NextResponse.json({
      connected: false,
      error: "Google Business client credentials, refresh token, account ID, or location ID are not configured.",
    }, { status: 400 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return NextResponse.json({
      connected: false,
      error: tokenPayload.error_description || tokenPayload.error || "Unable to refresh Google Business access token.",
    }, { status: tokenResponse.status || 400 });
  }

  const locationResponse = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${encodeURIComponent(locationId)}?readMask=name,title,storefrontAddress,metadata`,
    {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      cache: "no-store",
    },
  );
  const locationPayload = await locationResponse.json().catch(() => ({}));

  if (!locationResponse.ok) {
    return NextResponse.json({
      connected: false,
      error: locationPayload?.error?.message || "Google Business location validation failed.",
    }, { status: locationResponse.status });
  }

  return NextResponse.json({
    connected: true,
    account: { id: accountId },
    location: {
      id: locationId,
      name: locationPayload.name || `locations/${locationId}`,
      title: locationPayload.title || "Google Business location",
      address: locationPayload.storefrontAddress || null,
      placeId: locationPayload.metadata?.placeId || null,
    },
  });
}
