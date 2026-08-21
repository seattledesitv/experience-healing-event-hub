import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function combineCopy(caption: string | null, hashtags: string | null) {
  return [caption?.trim(), hashtags?.trim()].filter(Boolean).join("\n\n");
}

function linkedInHeaders(token: string, version: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": version,
    "Content-Type": "application/json",
  };
}

async function getMemberUrn(token: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error_description || `LinkedIn member lookup failed (${response.status}).`);
  if (!payload.sub) throw new Error("LinkedIn did not return the authenticated member ID.");
  return `urn:li:person:${payload.sub}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const version = process.env.LINKEDIN_API_VERSION || "202606";
  if (!token) return NextResponse.json({ error: "LinkedIn access token is not configured." }, { status: 400 });

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("id,title,cover_image_url,linkedin_caption,hashtags").eq("id", eventId).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventId).eq("channel", "linkedin").single(),
  ]);

  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "LinkedIn publication record not found." }, { status: 404 });
  if (!publication.enabled) return NextResponse.json({ error: "LinkedIn is not selected for this event." }, { status: 400 });
  if (publication.status === "published" || publication.external_id) {
    return NextResponse.json({ published: true, alreadyPublished: true, id: publication.external_id, url: publication.external_url });
  }

  await supabase.from("event_publications").update({ status: "publishing", last_error: null }).eq("id", publication.id);

  try {
    const memberUrn = await getMemberUrn(token);
    let imageUrn: string | null = null;

    if (event.cover_image_url) {
      const initializeResponse = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
        method: "POST",
        headers: linkedInHeaders(token, version),
        body: JSON.stringify({ initializeUploadRequest: { owner: memberUrn } }),
        cache: "no-store",
      });
      const initialized = await initializeResponse.json().catch(() => ({}));
      if (!initializeResponse.ok) throw new Error(initialized?.message || `LinkedIn image initialization failed (${initializeResponse.status}).`);

      const uploadUrl = initialized?.value?.uploadUrl;
      imageUrn = initialized?.value?.image || null;
      if (!uploadUrl || !imageUrn) throw new Error("LinkedIn did not return an image upload URL.");

      const sourceResponse = await fetch(event.cover_image_url, { cache: "no-store" });
      if (!sourceResponse.ok) throw new Error("Unable to download the event image for LinkedIn.");
      const imageBytes = await sourceResponse.arrayBuffer();
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": sourceResponse.headers.get("content-type") || "application/octet-stream",
        },
        body: imageBytes,
      });
      if (!uploadResponse.ok) throw new Error(`LinkedIn image upload failed (${uploadResponse.status}).`);
    }

    const commentary = combineCopy(event.linkedin_caption, event.hashtags) || event.title;
    const postBody: Record<string, unknown> = {
      author: memberUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (imageUrn) {
      postBody.content = { media: { title: event.title, altText: event.title, id: imageUrn } };
    }

    const postResponse = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: linkedInHeaders(token, version),
      body: JSON.stringify(postBody),
      cache: "no-store",
    });
    const responsePayload = await postResponse.json().catch(() => ({}));
    if (!postResponse.ok) throw new Error(responsePayload?.message || `LinkedIn publish failed (${postResponse.status}).`);

    const postId = postResponse.headers.get("x-restli-id");
    if (!postId) throw new Error("LinkedIn published the post but did not return a post ID.");

    const postUrl = `https://www.linkedin.com/feed/update/${postId}/`;
    const publishedAt = new Date().toISOString();
    await supabase.from("event_publications").update({
      status: "published", external_id: postId, external_url: postUrl, published_at: publishedAt, last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({ published: true, id: postId, url: postUrl, publishedAt, author: memberUrn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publish failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
