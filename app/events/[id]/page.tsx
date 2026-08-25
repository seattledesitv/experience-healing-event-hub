"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import PublishControls from "./PublishControls";

const channels = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "wix", label: "Wix" },
];
const activeChannelIds = new Set(channels.map((channel) => channel.id));

type EventRecord = {
  id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  registration_url: string | null;
  is_free: boolean;
  price_cents: number | null;
  currency: string | null;
  capacity: number | null;
  cover_image_url: string | null;
  facebook_caption: string | null;
  instagram_caption: string | null;
  linkedin_caption: string | null;
  hashtags: string | null;
  status: string;
};

type Publication = {
  channel: string;
  enabled: boolean;
  status: string;
  external_url: string | null;
  last_error: string | null;
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function displayDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const eventId = params.id;
  const reviewMode = searchParams.get("mode") === "review";

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { window.location.href = "/login"; return; }

        const [{ data: eventData, error: eventError }, { data: publicationData, error: publicationError }] = await Promise.all([
          supabase.from("events").select("*").eq("id", eventId).single(),
          supabase.from("event_publications").select("channel,enabled,status,external_url,last_error").eq("event_id", eventId),
        ]);
        if (eventError) throw eventError;
        if (publicationError) throw publicationError;
        const activePublications = (publicationData ?? []).filter((item) => activeChannelIds.has(item.channel));
        setEvent(eventData as EventRecord);
        setPublications(activePublications as Publication[]);
        setSelectedChannels(activePublications.filter((item) => item.enabled).map((item) => item.channel));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load event");
      } finally { setLoading(false); }
    }
    loadEvent();
  }, [eventId]);

  function toggleChannel(channel: string) {
    setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  }

  async function deleteFromHub() {
    const external = publications.filter((item) => item.external_url || item.status === "published").map((item) => item.channel);
    const warning = external.length
      ? `Delete this master event from the Hub? External records still exist on: ${external.join(", ")}. Delete those from the Review screen first if you want them removed too.`
      : "Delete this master event from the Hub? This cannot be undone.";
    if (!window.confirm(warning)) return;
    if (external.length && !window.confirm("External events/posts will NOT be deleted by this action. Continue deleting only the Hub master event?")) return;

    setDeleting(true); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("events").delete().eq("id", eventId);
      if (deleteError) throw deleteError;
      window.location.href = "/events";
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete event from Hub.");
      setDeleting(false);
    }
  }

  async function saveChanges(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!event) return;
    const form = new FormData(formEvent.currentTarget);
    setSaving(true); setError(""); setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const text = (key: string) => { const v = form.get(key); return typeof v === "string" && v.trim() ? v.trim() : null; };
      const iso = (key: string) => { const v = text(key); return v ? new Date(v).toISOString() : null; };
      const pricingType = text("pricing_type") || "free";
      const price = Number(text("price") || 0);
      if (pricingType === "paid" && (!Number.isFinite(price) || price <= 0)) throw new Error("Enter a ticket price greater than 0 for a paid event.");

      const payload = {
        title: text("title") ?? event.title,
        short_description: text("short_description"),
        description: text("description"),
        start_at: iso("start_at"),
        end_at: iso("end_at"),
        venue_name: text("venue_name"),
        address_line1: text("address_line1"),
        address_line2: text("address_line2"),
        city: text("city"),
        state: text("state"),
        postal_code: text("postal_code"),
        country: text("country") || "US",
        registration_url: text("registration_url"),
        is_free: pricingType !== "paid",
        price_cents: pricingType === "paid" ? Math.round(price * 100) : null,
        currency: text("currency") || "USD",
        capacity: text("capacity") ? Number(text("capacity")) : null,
        facebook_caption: text("facebook_caption"),
        instagram_caption: text("instagram_caption"),
        linkedin_caption: text("linkedin_caption"),
        hashtags: text("hashtags"),
      };

      const { data: updated, error: updateError } = await supabase.from("events").update(payload).eq("id", eventId).select("*").single();
      if (updateError) throw updateError;

      const publicationRows = channels.map((channel) => ({
        event_id: eventId,
        channel: channel.id,
        enabled: selectedChannels.includes(channel.id),
        status: selectedChannels.includes(channel.id) ? "pending" : "not_selected",
      }));
      const { error: publicationError } = await supabase.from("event_publications").upsert(publicationRows, { onConflict: "event_id,channel" });
      if (publicationError) throw publicationError;
      setEvent(updated as EventRecord);
      setMessage("Event updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update event");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="shell"><section className="panel"><p>Loading event...</p></section></main>;
  if (!event) return <main className="shell"><section className="panel"><p className="formError">{error || "Event not found."}</p></section></main>;

  if (reviewMode) {
    const priceLabel = event.is_free ? "Free / RSVP" : `${event.currency || "USD"} ${((event.price_cents || 0) / 100).toFixed(2)}`;
    return (
      <main className="shell">
        <section className="hero compactHero"><div><p className="eyebrow">Review event</p><h1>{event.title}</h1><p className="lede">Review the master event and every selected destination before publishing.</p></div><div className="heroActions"><Link className="secondaryButton inlineButton" href={`/events/${event.id}`}>Back to edit</Link><Link className="secondaryButton inlineButton" href="/events">All events</Link></div></section>
        <section className="reviewGrid">
          <article className="panel reviewMain">
            {event.cover_image_url ? <img className="reviewImage" src={event.cover_image_url} alt="Event flyer" /> : null}
            <p className="eyebrow">Event details</p><h2>{event.title}</h2><p className="reviewLead">{event.short_description || "No short description."}</p>
            <div className="reviewFacts">
              <div><strong>Starts</strong><span>{displayDate(event.start_at)}</span></div>
              <div><strong>Ends</strong><span>{displayDate(event.end_at)}</span></div>
              <div><strong>Venue</strong><span>{event.venue_name || "Not set"}</span></div>
              <div><strong>Location</strong><span>{[event.address_line1, event.address_line2, event.city, event.state, event.postal_code].filter(Boolean).join(", ") || "Not set"}</span></div>
              <div><strong>Pricing</strong><span>{priceLabel}</span></div>
              <div><strong>Capacity</strong><span>{event.capacity || "Not set"}</span></div>
              <div><strong>Registration</strong><span>{event.registration_url || "Not set"}</span></div>
            </div>
            <div className="reviewCopy"><h3>Description</h3><p>{event.description || "No description."}</p><h3>Facebook copy</h3><p>{event.facebook_caption || "Uses the short/full description when blank."}</p><h3>Instagram copy</h3><p>{event.instagram_caption || "No Instagram caption."}</p><h3>LinkedIn copy</h3><p>{event.linkedin_caption || "No LinkedIn caption."}</p><h3>Hashtags</h3><p>{event.hashtags || "No hashtags."}</p></div>
          </article>
          <aside className="panel reviewSidebar"><PublishControls eventId={event.id} publications={publications} selectedChannels={selectedChannels} /></aside>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero compactHero"><div><p className="eyebrow">Edit event</p><h1>{event.title}</h1><p className="lede">Update the master event before reviewing the channel-specific output.</p></div><div className="heroActions"><Link className="primaryButton inlineButton" href={`/events/${event.id}?mode=review`}>Review event</Link><Link className="secondaryButton inlineButton" href="/events">All events</Link></div></section>
      <form className="panel eventForm" onSubmit={saveChanges}>
        <div className="formSection"><div><p className="eyebrow">Event details</p><h2>Core information</h2></div><label>Event title<input name="title" defaultValue={event.title} required /></label><label>Short description<input name="short_description" defaultValue={event.short_description ?? ""} /></label><label>Full description<textarea name="description" rows={7} defaultValue={event.description ?? ""} /></label><div className="twoCol"><label>Starts<input name="start_at" type="datetime-local" defaultValue={localDateTime(event.start_at)} /></label><label>Ends<input name="end_at" type="datetime-local" defaultValue={localDateTime(event.end_at)} /></label></div></div>

        <div className="formSection"><div><p className="eyebrow">Location & registration</p><h2>Where people join</h2></div><label>Venue name<input name="venue_name" defaultValue={event.venue_name ?? ""} /></label><label>Address line 1<input name="address_line1" defaultValue={event.address_line1 ?? ""} /></label><label>Address line 2<input name="address_line2" defaultValue={event.address_line2 ?? ""} /></label><div className="threeCol"><label>City<input name="city" defaultValue={event.city ?? ""} /></label><label>State<input name="state" defaultValue={event.state ?? ""} /></label><label>ZIP<input name="postal_code" defaultValue={event.postal_code ?? ""} /></label></div><div className="twoCol"><label>Country<input name="country" defaultValue={event.country ?? "US"} /></label><label>Capacity<input name="capacity" type="number" min="1" defaultValue={event.capacity ?? ""} /></label></div><label>Registration URL<input name="registration_url" type="url" defaultValue={event.registration_url ?? ""} /></label></div>

        <div className="formSection"><div><p className="eyebrow">Pricing</p><h2>Free or paid event</h2></div><div className="threeCol"><label>Pricing type<select name="pricing_type" defaultValue={event.is_free ? "free" : "paid"}><option value="free">Free / RSVP</option><option value="paid">Paid / Ticketed</option></select></label><label>Ticket price<input name="price" type="number" min="0" step="0.01" defaultValue={event.price_cents ? (event.price_cents / 100).toFixed(2) : ""} /></label><label>Currency<select name="currency" defaultValue={event.currency || "USD"}><option value="USD">USD</option><option value="CAD">CAD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option></select></label></div><p className="mutedText">Changing a Wix event from RSVP to ticketed (or ticketed to RSVP) requires deleting and recreating the Wix draft because Wix locks the initial registration type.</p></div>

        <div className="formSection"><div><p className="eyebrow">Media</p><h2>Current event image</h2></div>{event.cover_image_url ? <img className="eventPreviewImage" src={event.cover_image_url} alt="Current event flyer" /> : <p>No image uploaded.</p>}<p className="mutedText">The Cloudinary source image remains attached to the Hub event.</p></div>
        <div className="formSection"><div><p className="eyebrow">Social copy</p><h2>Customize by channel</h2></div><label>Facebook caption<textarea name="facebook_caption" rows={5} defaultValue={event.facebook_caption ?? ""} placeholder="Facebook-ready copy..." /></label><label>Instagram caption<textarea name="instagram_caption" rows={5} defaultValue={event.instagram_caption ?? ""} /></label><label>LinkedIn caption<textarea name="linkedin_caption" rows={5} defaultValue={event.linkedin_caption ?? ""} /></label><label>Hashtags<input name="hashtags" defaultValue={event.hashtags ?? ""} /></label></div>
        <div className="formSection"><div><p className="eyebrow">Destinations</p><h2>Select where to publish</h2></div><div className="channelGrid">{channels.map((channel) => { const selected = selectedChannels.includes(channel.id); return <button className={`channel channelButton ${selected ? "selected" : ""}`} type="button" key={channel.id} onClick={() => toggleChannel(channel.id)}><strong>{channel.label}</strong><small>{selected ? "Selected" : "Not selected"}</small></button>; })}</div></div>
        {error ? <p className="formError">{error}</p> : null}{message ? <p className="formSuccess">{message}</p> : null}
        <div className="formActions"><button className="secondaryButton" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button><Link className="primaryButton inlineButton" href={`/events/${event.id}?mode=review`}>Review event</Link></div>
        <div className="formSection"><div><p className="eyebrow">Danger zone</p><h2>Delete master event</h2></div><p className="mutedText">This removes the event only from the Experience Healing Hub. Delete external Wix/Eventbrite records from Review first if you want those removed too.</p><button className="secondaryButton" type="button" disabled={deleting} onClick={deleteFromHub}>{deleting ? "Deleting..." : "Delete from Hub"}</button></div>
      </form>
    </main>
  );
}
