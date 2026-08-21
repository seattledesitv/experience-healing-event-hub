"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const channels = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "humanitix", label: "Humanitix" },
  { id: "wix", label: "Wix" },
];

type EventRecord = {
  id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  registration_url: string | null;
  cover_image_url: string | null;
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
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const publicationMap = useMemo(
    () => new Map(publications.map((publication) => [publication.channel, publication])),
    [publications],
  );

  useEffect(() => {
    async function loadEvent() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = "/login";
          return;
        }

        const [{ data: eventData, error: eventError }, { data: publicationData, error: publicationError }] = await Promise.all([
          supabase.from("events").select("*").eq("id", eventId).single(),
          supabase.from("event_publications").select("channel,enabled,status,external_url,last_error").eq("event_id", eventId),
        ]);

        if (eventError) throw eventError;
        if (publicationError) throw publicationError;

        setEvent(eventData as EventRecord);
        setPublications((publicationData ?? []) as Publication[]);
        setSelectedChannels((publicationData ?? []).filter((item) => item.enabled).map((item) => item.channel));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load event");
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventId]);

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  }

  async function saveChanges(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!event) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const form = new FormData(formEvent.currentTarget);
      const text = (key: string) => {
        const value = form.get(key);
        return typeof value === "string" && value.trim() ? value.trim() : null;
      };
      const iso = (key: string) => {
        const value = text(key);
        return value ? new Date(value).toISOString() : null;
      };

      const payload = {
        title: text("title") ?? event.title,
        short_description: text("short_description"),
        description: text("description"),
        start_at: iso("start_at"),
        end_at: iso("end_at"),
        venue_name: text("venue_name"),
        address_line1: text("address_line1"),
        city: text("city"),
        state: text("state"),
        postal_code: text("postal_code"),
        registration_url: text("registration_url"),
        instagram_caption: text("instagram_caption"),
        linkedin_caption: text("linkedin_caption"),
        hashtags: text("hashtags"),
      };

      const { data: updated, error: updateError } = await supabase
        .from("events")
        .update(payload)
        .eq("id", eventId)
        .select("*")
        .single();
      if (updateError) throw updateError;

      const publicationRows = channels.map((channel) => ({
        event_id: eventId,
        channel: channel.id,
        enabled: selectedChannels.includes(channel.id),
        status: selectedChannels.includes(channel.id) ? "pending" : "not_selected",
      }));

      const { error: publicationError } = await supabase
        .from("event_publications")
        .upsert(publicationRows, { onConflict: "event_id,channel" });
      if (publicationError) throw publicationError;

      setEvent(updated as EventRecord);
      setMessage("Event updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update event");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="shell"><section className="panel"><p>Loading event...</p></section></main>;
  }

  if (!event) {
    return <main className="shell"><section className="panel"><p className="formError">{error || "Event not found."}</p></section></main>;
  }

  if (reviewMode) {
    return (
      <main className="shell">
        <section className="hero compactHero">
          <div>
            <p className="eyebrow">Review event</p>
            <h1>{event.title}</h1>
            <p className="lede">Review the master event and every selected destination before publishing.</p>
          </div>
          <div className="heroActions">
            <Link className="secondaryButton inlineButton" href={`/events/${event.id}`}>Back to edit</Link>
            <Link className="secondaryButton inlineButton" href="/events">All events</Link>
          </div>
        </section>

        <section className="reviewGrid">
          <article className="panel reviewMain">
            {event.cover_image_url ? <img className="reviewImage" src={event.cover_image_url} alt="Event flyer" /> : null}
            <p className="eyebrow">Event details</p>
            <h2>{event.title}</h2>
            <p className="reviewLead">{event.short_description || "No short description."}</p>
            <div className="reviewFacts">
              <div><strong>Starts</strong><span>{displayDate(event.start_at)}</span></div>
              <div><strong>Ends</strong><span>{displayDate(event.end_at)}</span></div>
              <div><strong>Venue</strong><span>{event.venue_name || "Not set"}</span></div>
              <div><strong>Location</strong><span>{[event.address_line1, event.city, event.state, event.postal_code].filter(Boolean).join(", ") || "Not set"}</span></div>
              <div><strong>Registration</strong><span>{event.registration_url || "Not set"}</span></div>
            </div>
            <div className="reviewCopy">
              <h3>Description</h3>
              <p>{event.description || "No description."}</p>
              <h3>Instagram copy</h3>
              <p>{event.instagram_caption || "No Instagram caption."}</p>
              <h3>LinkedIn copy</h3>
              <p>{event.linkedin_caption || "No LinkedIn caption."}</p>
              <h3>Hashtags</h3>
              <p>{event.hashtags || "No hashtags."}</p>
            </div>
          </article>

          <aside className="panel reviewSidebar">
            <p className="eyebrow">Publishing destinations</p>
            <h2>Channel readiness</h2>
            <div className="publishList">
              {channels.map((channel) => {
                const publication = publicationMap.get(channel.id);
                const enabled = selectedChannels.includes(channel.id);
                return (
                  <div className="publishRow" key={channel.id}>
                    <div>
                      <strong>{channel.label}</strong>
                      <small>{enabled ? "Selected" : "Not selected"}</small>
                    </div>
                    <span className={`statusPill ${enabled ? "status-pending" : "status-not_selected"}`}>
                      {publication?.status || (enabled ? "pending" : "not selected")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="publishNotice">
              <strong>Publishing is intentionally locked.</strong>
              <p>Next we will connect Instagram and LinkedIn, then enable the publish action only when their credentials validate successfully.</p>
            </div>
            <button className="primaryButton fullButton" type="button" disabled>Publish selected channels</button>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero compactHero">
        <div>
          <p className="eyebrow">Edit event</p>
          <h1>{event.title}</h1>
          <p className="lede">Update the master event before reviewing the channel-specific output.</p>
        </div>
        <div className="heroActions">
          <Link className="primaryButton inlineButton" href={`/events/${event.id}?mode=review`}>Review event</Link>
          <Link className="secondaryButton inlineButton" href="/events">All events</Link>
        </div>
      </section>

      <form className="panel eventForm" onSubmit={saveChanges}>
        <div className="formSection">
          <div><p className="eyebrow">Event details</p><h2>Core information</h2></div>
          <label>Event title<input name="title" defaultValue={event.title} required /></label>
          <label>Short description<input name="short_description" defaultValue={event.short_description ?? ""} /></label>
          <label>Full description<textarea name="description" rows={7} defaultValue={event.description ?? ""} /></label>
          <div className="twoCol">
            <label>Starts<input name="start_at" type="datetime-local" defaultValue={localDateTime(event.start_at)} /></label>
            <label>Ends<input name="end_at" type="datetime-local" defaultValue={localDateTime(event.end_at)} /></label>
          </div>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">Location & registration</p><h2>Where people join</h2></div>
          <label>Venue name<input name="venue_name" defaultValue={event.venue_name ?? ""} /></label>
          <label>Address<input name="address_line1" defaultValue={event.address_line1 ?? ""} /></label>
          <div className="threeCol">
            <label>City<input name="city" defaultValue={event.city ?? ""} /></label>
            <label>State<input name="state" defaultValue={event.state ?? ""} /></label>
            <label>ZIP<input name="postal_code" defaultValue={event.postal_code ?? ""} /></label>
          </div>
          <label>Registration URL<input name="registration_url" type="url" defaultValue={event.registration_url ?? ""} /></label>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">Media</p><h2>Current event image</h2></div>
          {event.cover_image_url ? <img className="eventPreviewImage" src={event.cover_image_url} alt="Current event flyer" /> : <p>No image uploaded.</p>}
          <p className="mutedText">Image replacement will be added to the edit view in the next media pass. The original Cloudinary asset remains attached.</p>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">Social copy</p><h2>Customize by channel</h2></div>
          <label>Instagram caption<textarea name="instagram_caption" rows={5} defaultValue={event.instagram_caption ?? ""} /></label>
          <label>LinkedIn caption<textarea name="linkedin_caption" rows={5} defaultValue={event.linkedin_caption ?? ""} /></label>
          <label>Hashtags<input name="hashtags" defaultValue={event.hashtags ?? ""} /></label>
        </div>

        <div className="formSection">
          <div><p className="eyebrow">Destinations</p><h2>Select where to publish</h2></div>
          <div className="channelGrid">
            {channels.map((channel) => {
              const selected = selectedChannels.includes(channel.id);
              return (
                <button className={`channel channelButton ${selected ? "selected" : ""}`} type="button" key={channel.id} onClick={() => toggleChannel(channel.id)}>
                  <strong>{channel.label}</strong>
                  <small>{selected ? "Selected" : "Not selected"}</small>
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="formError">{error}</p> : null}
        {message ? <p className="formSuccess">{message}</p> : null}

        <div className="formActions">
          <button className="secondaryButton" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
          <Link className="primaryButton inlineButton" href={`/events/${event.id}?mode=review`}>Review event</Link>
        </div>
      </form>
    </main>
  );
}
