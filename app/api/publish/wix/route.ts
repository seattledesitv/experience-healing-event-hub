import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function wixHeaders(apiKey: string, siteId: string) {
  return {
    Authorization: apiKey,
    "wix-site-id": siteId,
    "Content-Type": "application/json",
  };
}

function richText(text: string | null) {
  if (!text?.trim()) return undefined;

  return {
    nodes: [
      {
        type: "PARAGRAPH",
        id: crypto.randomUUID().slice(0, 8),
        nodes: [
          {
            type: "TEXT",
            id: crypto.randomUUID().slice(0, 8),
            textData: {
              text: text.trim(),
              decorations: [],
            },
          },
        ],
        paragraphData: {
          textStyle: {
            textAlignment: "AUTO",
          },
          indentation: 0,
        },
      },
    ],
    metadata: { version: 1 },
    documentStyle: {},
  };
}

function wixStreetAddress(addressLine1: string | null) {
  if (!addressLine1?.trim()) return undefined;
  const value = addressLine1.trim();
  const match = value.match(/^([0-9A-Za-z-]+)\s+(.+)$/);
  if (!match) return { name: value };
  return {
    number: match[1],
    name: match[2],
  };
}

function buildEditableWixEvent(event: Record<string, any>) {
  const wixEvent: Record<string, unknown> = {
    title: event.title,
    dateAndTimeSettings: {
      startDate: new Date(event.start_at).toISOString(),
      endDate: new Date(event.end_at).toISOString(),
      timeZoneId: event.timezone || "America/Los_Angeles",
    },
  };

  const description = richText(event.description || event.short_description);
  if (description) wixEvent.description = description;

  if (event.venue_name || event.address_line1 || event.city) {
    wixEvent.location = {
      type: "VENUE",
      name: event.venue_name || event.address_line1 || event.city || "Event venue",
      locationTbd: false,
      address: {
        country: event.country || "US",
        city: event.city || undefined,
        subdivision: event.state || undefined,
        postalCode: event.postal_code || undefined,
        streetAddress: wixStreetAddress(event.address_line1),
        addressLine2: event.address_line2 || undefined,
      },
    };
  }

  return wixEvent;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const action = body.action === "delete" || body.action === "update" ? body.action : "create";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const apiKey = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!apiKey || !siteId) return NextResponse.json({ error: "Wix credentials are not configured." }, { status: 400 });

  const [{ data: event, error: eventError }, { data: publication, error: publicationError }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("event_publications").select("id,enabled,status,external_id,external_url").eq("event_id", eventId).eq("channel", "wix").single(),
  ]);

  if (eventError || !event) return NextResponse.json({ error: eventError?.message || "Event not found." }, { status: 404 });
  if (publicationError || !publication) return NextResponse.json({ error: publicationError?.message || "Wix publication record not found." }, { status: 404 });
  if (!publication.enabled && action !== "delete") return NextResponse.json({ error: "Wix is not selected for this event." }, { status: 400 });

  const headers = wixHeaders(apiKey, siteId);

  try {
    if (action === "delete") {
      if (!publication.external_id) return NextResponse.json({ deleted: true, alreadyDeleted: true });
      const response = await fetch(`https://www.wixapis.com/events/v3/events/${publication.external_id}`, { method: "DELETE", headers, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.details?.applicationError?.description || `Wix delete failed (${response.status}).`);
      await supabase.from("event_publications").update({ status: "pending", external_id: null, external_url: null, published_at: null, last_error: null }).eq("id", publication.id);
      return NextResponse.json({ deleted: true });
    }

    if (!event.start_at || !event.end_at) return NextResponse.json({ error: "Start and end date/time are required for Wix." }, { status: 400 });

    const editableEvent = buildEditableWixEvent(event);

    let response: Response;
    if (action === "update" && publication.external_id) {
      response = await fetch(`https://www.wixapis.com/events/v3/events/${publication.external_id}`, {
        method: "PATCH",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          event: { id: publication.external_id, ...editableEvent },
          fields: ["DETAILS", "TEXTS", "URLS"],
        }),
      });
    } else {
      const createEvent = {
        ...editableEvent,
        registration: {
          initialType: event.is_free === false ? "TICKETING" : "RSVP",
          ...(event.is_free === false
            ? { tickets: { currency: event.currency || "USD" } }
            : { rsvp: { responseType: "YES_ONLY" } }),
        },
      };

      response = await fetch("https://www.wixapis.com/events/v3/events", {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          event: createEvent,
          draft: true,
          fields: ["DETAILS", "TEXTS", "REGISTRATION", "URLS"],
        }),
      });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.details?.applicationError?.description || `Wix ${action} failed (${response.status}).`);

    const created = payload?.event || {};
    const externalId = created.id || publication.external_id;
    if (!externalId) throw new Error("Wix did not return an event ID.");
    const externalUrl = created.eventPageUrl || created.url || publication.external_url || null;
    await supabase.from("event_publications").update({
      status: "published",
      external_id: externalId,
      external_url: externalUrl,
      published_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", publication.id);

    return NextResponse.json({
      published: true,
      draft: true,
      id: externalId,
      url: externalUrl,
      action: publication.external_id ? "updated" : "created",
      imagePending: Boolean(event.cover_image_url),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wix operation failed.";
    await supabase.from("event_publications").update({ status: "failed", last_error: message }).eq("id", publication.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
