import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function eventList(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function eventTitle(event: any) {
  return event?.name || event?.title || event?.eventName || "";
}

function eventId(event: any) {
  return event?.id || event?._id || event?.eventId || null;
}

function eventUrl(event: any) {
  return event?.url || event?.eventUrl || event?.publicUrl || event?.link || null;
}

function eventStart(event: any) {
  return event?.startDate || event?.start_at || event?.start || event?.date?.start || event?.startDateTime || null;
}

function sameDay(a: string | null, b: string | null) {
  if (!a || !b) return false;
  const left = new Date(a);
  const right = new Date(b);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false;
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventIdValue = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventIdValue) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const apiKey = process.env.HUMANITIX_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Humanitix API key is not configured." }, { status: 400 });

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("id,title,start_at").eq("id", eventIdValue).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventIdValue).eq("channel", "humanitix").single(),
  ]);

  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "Humanitix publication record not found." }, { status: 404 });
  if (!publication.enabled) return NextResponse.json({ error: "Humanitix is not selected for this event." }, { status: 400 });

  const response = await fetch("https://api.humanitix.com/v1/events?page=1", {
    cache: "no-store",
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Humanitix returned ${response.status}.`;
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const events = eventList(payload);
  const title = normalize(event.title);

  const exact = events.find((item: any) => normalize(eventTitle(item)) === title && sameDay(eventStart(item), event.start_at));
  const titleOnly = events.find((item: any) => normalize(eventTitle(item)) === title);
  const match = exact || titleOnly || null;

  if (!match) {
    await supabase.from("event_publications").update({
      status: "manual_action_required",
      external_id: null,
      external_url: null,
      last_error: "No matching Humanitix event was found. Create it manually in Humanitix, then run Check Humanitix again.",
    }).eq("id", publication.id);

    return NextResponse.json({
      matched: false,
      checked: events.length,
      message: "No matching Humanitix event found.",
    });
  }

  const externalId = eventId(match);
  const externalUrl = eventUrl(match);

  await supabase.from("event_publications").update({
    status: "published",
    external_id: externalId,
    external_url: externalUrl,
    published_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", publication.id);

  return NextResponse.json({
    matched: true,
    checked: events.length,
    id: externalId,
    url: externalUrl,
    name: eventTitle(match),
    matchType: exact ? "title_and_date" : "title",
  });
}
