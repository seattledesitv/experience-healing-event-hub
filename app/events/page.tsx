"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string;
  start_at: string | null;
  venue_name: string | null;
  city: string | null;
  status: string;
  cover_image_url: string | null;
  updated_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "Date not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvents() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = "/login";
          return;
        }

        const { data, error: queryError } = await supabase
          .from("events")
          .select("id,title,start_at,venue_name,city,status,cover_image_url,updated_at")
          .order("updated_at", { ascending: false });

        if (queryError) throw queryError;
        setEvents(data ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load events");
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  return (
    <main className="shell">
      <section className="hero compactHero">
        <div>
          <p className="eyebrow">Event Studio</p>
          <h1>Your events</h1>
          <p className="lede">Create, edit, review, and eventually publish every Experience Healing event from one place.</p>
        </div>
        <div className="heroActions">
          <Link className="primaryButton inlineButton" href="/events/new">Create event</Link>
          <Link className="secondaryButton inlineButton" href="/dashboard">Dashboard</Link>
        </div>
      </section>

      <section className="panel">
        {loading ? <p>Loading events...</p> : null}
        {error ? <p className="formError">{error}</p> : null}
        {!loading && !error && events.length === 0 ? (
          <div className="emptyState">
            <h2>No events yet</h2>
            <p>Create your first event and save it as a draft.</p>
            <Link className="primaryButton inlineButton" href="/events/new">Create first event</Link>
          </div>
        ) : null}

        <div className="eventList">
          {events.map((event) => (
            <article className="eventCard" key={event.id}>
              {event.cover_image_url ? (
                <img className="eventCardImage" src={event.cover_image_url} alt="" />
              ) : (
                <div className="eventCardImage placeholderImage">No image</div>
              )}
              <div className="eventCardBody">
                <div className="eventCardTopline">
                  <span className={`statusPill status-${event.status}`}>{event.status}</span>
                  <small>Updated {formatDate(event.updated_at)}</small>
                </div>
                <h2>{event.title}</h2>
                <p>{formatDate(event.start_at)}</p>
                <p>{[event.venue_name, event.city].filter(Boolean).join(" · ") || "Location not set"}</p>
                <div className="cardActions">
                  <Link className="secondaryButton inlineButton" href={`/events/${event.id}`}>Edit</Link>
                  <Link className="primaryButton inlineButton" href={`/events/${event.id}?mode=review`}>Review</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
