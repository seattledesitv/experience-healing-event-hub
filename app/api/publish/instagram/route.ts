import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function combineCopy(caption: string | null, hashtags: string | null) {
  return [caption?.trim(), hashtags?.trim()].filter(Boolean).join("\n\n");
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const version = process.env.META_GRAPH_API_VERSION || "v26.0";
  if (!token || !accountId) {
    return NextResponse.json({ error: "Instagram credentials are not configured." }, { status: 400 });
  }

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("id,title,cover_image_url,instagram_caption,hashtags").eq("id", eventId).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventId).eq("channel", "instagram").single(),
  ]);

  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "Instagram publication record not found." }, { status: 404 });
  if (!publication.enabled) return NextResponse.json({ error: "Instagram is not selected for this event." }, { status: 400 });
  if (publication.status === "published" || publication.external_id) {
    return NextResponse.json({ published: true, alreadyPublished: true, id: publication.external_id, url: publication.external_url });
  }
  if (!event.cover_image_url) return NextResponse.json({ error: "Instagram publishing requires an event image." }, { status: 400 });

  await supabase.from("event_publications").update({ status: "publishing", last_error: null }).eq("id", publication.id);

  try {
    const createUrl = new URL(`https://graph.instagram.com/${version}/${accountId}/media`);
    createUrl.searchParams.set("image_url", event.cover_image_url);
    const caption = combineCopy(event.instagram_caption || event.title, event.hashtags);
    if (caption) createUrl.searchParams.set("caption", caption);
    createUrl.searchParams.set("access_token", token);

    const createResponse = await fetch(createUrl, { method: "POST", cache: "no-store" });
    const created = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok || !created.id) throw new Error(created?.error?.message || "Instagram media container creation failed.");

    const publishUrl = new URL(`https://graph.instagram.com/${version}/${accountId}/media_publish`);
    publishUrl.searchParams.set("creation_id", created.id);
    publishUrl.searchParams.set("access_token", token);
    const publishResponse = await fetch(publishUrl, { method: "POST", cache: "no-store" });
    const published = await publishResponse.json().catch(() => ({}));
    if (!publishResponse.ok || !published.id) throw new Error(published?.error?.message || "Instagram publish failed.");

    let permalink: string | null = null;
    const lookupUrl = new URL(`https://graph.instagram.com/${version}/${published.id}`);
    lookupUrl.searchParams.set("fields", "permalink");
    lookupUrl.searchParams.set("access_token", token);
    const lookupResponse = await fetch(lookupUrl, { cache: "no-store" });
    if (lookupResponse.ok) {
      const lookup = await lookupResponse.json().catch(() => ({}));
      permalink = lookup.permalink || null;
    }

    const publishedAt = new Date().toISOString();
    await supabase.from("event_publications").update({
      status: "published",
      external_id: published.id,
      external_url: permalink,
      published_at: publishedAt,
      last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({ published: true, id: published.id, url: permalink, publishedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram publish failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
