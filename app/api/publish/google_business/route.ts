import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccessToken() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Business OAuth credentials are not configured.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Unable to refresh Google Business access token.");
  return payload.access_token as string;
}

function googleParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    date: { year: get("year"), month: get("month"), day: get("day") },
    time: { hours: get("hour"), minutes: get("minute"), seconds: get("second"), nanos: 0 },
  };
}

function buildPost(event: Record<string, any>) {
  if (!event.start_at || !event.end_at) throw new Error("Start and end date/time are required for Google Business event posts.");
  const timeZone = event.timezone || "America/Los_Angeles";
  const start = googleParts(event.start_at, timeZone);
  const end = googleParts(event.end_at, timeZone);
  const summary = event.description || event.short_description || event.title;
  return {
    languageCode: "en-US",
    summary: String(summary).slice(0, 1500),
    topicType: "EVENT",
    event: {
      title: String(event.title).slice(0, 58),
      schedule: { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time },
    },
    ...(event.registration_url ? { callToAction: { actionType: "SIGN_UP", url: event.registration_url } } : {}),
    ...(event.cover_image_url ? { media: [{ mediaFormat: "PHOTO", sourceUrl: event.cover_image_url }] } : {}),
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const action = body.action === "delete" || body.action === "update" ? body.action : "create";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;
  if (!accountId || !locationId) return NextResponse.json({ error: "Google Business account ID or location ID is not configured." }, { status: 400 });

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventId).eq("channel", "google_business").single(),
  ]);
  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "Google Business publication record not found. Apply migration 005 first." }, { status: 404 });
  if (!publication.enabled && action !== "delete") return NextResponse.json({ error: "Google Business is not selected for this event." }, { status: 400 });

  try {
    const accessToken = await getAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const parent = `accounts/${accountId}/locations/${locationId}`;

    if (action === "delete") {
      if (publication.external_id) {
        const name = publication.external_id.startsWith("accounts/") ? publication.external_id : `${parent}/localPosts/${publication.external_id}`;
        const response = await fetch(`https://mybusiness.googleapis.com/v4/${name}`, { method: "DELETE", headers, cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(payload?.error?.message || `Google Business delete failed (${response.status}).`);
      }
      await supabase.from("event_publications").update({ status: "pending", external_id: null, external_url: null, published_at: null, last_error: null }).eq("id", publication.id);
      return NextResponse.json({ deleted: true });
    }

    const post = buildPost(event);
    let response: Response;
    if (action === "update" && publication.external_id) {
      const name = publication.external_id.startsWith("accounts/") ? publication.external_id : `${parent}/localPosts/${publication.external_id}`;
      response = await fetch(`https://mybusiness.googleapis.com/v4/${name}?updateMask=summary,event,callToAction,media`, {
        method: "PATCH", headers, body: JSON.stringify({ ...post, name }), cache: "no-store",
      });
    } else {
      response = await fetch(`https://mybusiness.googleapis.com/v4/${parent}/localPosts`, {
        method: "POST", headers, body: JSON.stringify(post), cache: "no-store",
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Google Business ${action} failed (${response.status}).`);
    const externalId = payload.name || publication.external_id;
    if (!externalId) throw new Error("Google Business did not return a local post ID.");
    const externalUrl = payload.searchUrl || publication.external_url || null;

    await supabase.from("event_publications").update({
      status: "published", external_id: externalId, external_url: externalUrl,
      published_at: new Date().toISOString(), last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({ published: true, id: externalId, url: externalUrl, action: action === "update" && publication.external_id ? "updated" : "created" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Business operation failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
