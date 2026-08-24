import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function combineCopy(caption: string | null, fallback: string, hashtags: string | null) {
  return [caption?.trim() || fallback.trim(), hashtags?.trim()].filter(Boolean).join("\n\n");
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const version = process.env.META_GRAPH_API_VERSION || "v26.0";
  if (!token || !pageId) {
    return NextResponse.json({ error: "Facebook Page credentials are not configured." }, { status: 400 });
  }

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("id,title,short_description,description,cover_image_url,facebook_caption,hashtags").eq("id", eventId).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventId).eq("channel", "facebook").single(),
  ]);

  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "Facebook publication record not found." }, { status: 404 });
  if (!publication.enabled) return NextResponse.json({ error: "Facebook is not selected for this event." }, { status: 400 });
  if (publication.status === "published" || publication.external_id) {
    return NextResponse.json({ published: true, alreadyPublished: true, id: publication.external_id, url: publication.external_url });
  }

  await supabase.from("event_publications").update({ status: "publishing", last_error: null }).eq("id", publication.id);

  try {
    const fallback = event.short_description || event.description || event.title;
    const message = combineCopy(event.facebook_caption, fallback, event.hashtags);

    let response: Response;
    if (event.cover_image_url) {
      const url = new URL(`https://graph.facebook.com/${version}/${pageId}/photos`);
      url.searchParams.set("url", event.cover_image_url);
      url.searchParams.set("caption", message);
      url.searchParams.set("published", "true");
      url.searchParams.set("access_token", token);
      response = await fetch(url, { method: "POST", cache: "no-store" });
    } else {
      const url = new URL(`https://graph.facebook.com/${version}/${pageId}/feed`);
      url.searchParams.set("message", message);
      url.searchParams.set("access_token", token);
      response = await fetch(url, { method: "POST", cache: "no-store" });
    }

    const published = await response.json().catch(() => ({}));
    if (!response.ok || (!published.id && !published.post_id)) {
      throw new Error(published?.error?.message || "Facebook publish failed.");
    }

    const externalId = published.post_id || published.id;
    let permalink: string | null = null;
    const lookupUrl = new URL(`https://graph.facebook.com/${version}/${externalId}`);
    lookupUrl.searchParams.set("fields", "permalink_url");
    lookupUrl.searchParams.set("access_token", token);
    const lookupResponse = await fetch(lookupUrl, { cache: "no-store" });
    if (lookupResponse.ok) {
      const lookup = await lookupResponse.json().catch(() => ({}));
      permalink = lookup.permalink_url || null;
    }

    const publishedAt = new Date().toISOString();
    await supabase.from("event_publications").update({
      status: "published",
      external_id: externalId,
      external_url: permalink,
      published_at: publishedAt,
      last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({ published: true, id: externalId, url: permalink, publishedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook publish failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
