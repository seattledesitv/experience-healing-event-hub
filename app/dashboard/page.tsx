"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type EventSummary = { id: string; title: string; start_at: string | null; status: string; venue_name: string | null };

const destinations = ["Facebook", "Instagram", "LinkedIn", "Eventbrite", "Humanitix", "Wix"];

export default function DashboardPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.from("events").select("id,title,start_at,status,venue_name").order("start_at", { ascending: true, nullsFirst: false }).then(({ data }) => setEvents((data || []) as EventSummary[]));
  }, []);

  const now = new Date();
  const upcoming = useMemo(() => events.filter((event) => event.start_at && new Date(event.start_at) >= now).slice(0, 5), [events]);
  const published = events.filter((event) => event.status === "published").length;
  const drafts = events.filter((event) => event.status === "draft").length;
  const attention = events.filter((event) => event.status === "publishing").length;

  return (
    <main className="shell appShellPage">
      <section className="pageHeader brandedHeader">
        <div><p className="eyebrow">Experience Healing Event Hub</p><h1>Publishing overview</h1><p className="lede">Create once, coordinate every destination, and keep the full event lifecycle organized.</p></div>
        <Link className="primaryButton inlineButton" href="/events/new">+ Create Event</Link>
      </section>

      <section className="metricGrid">
        <article className="metricCard"><span>Upcoming</span><strong>{upcoming.length}</strong><small>next scheduled events</small></article>
        <article className="metricCard"><span>Drafts</span><strong>{drafts}</strong><small>still being prepared</small></article>
        <article className="metricCard"><span>Published</span><strong>{published}</strong><small>master events completed</small></article>
        <article className="metricCard"><span>Needs attention</span><strong>{attention}</strong><small>currently publishing</small></article>
      </section>

      <section className="dashboardGrid">
        <article className="panel">
          <div className="sectionHeading"><div><p className="eyebrow">Next on the calendar</p><h2>Upcoming events</h2></div><Link href="/events?view=calendar" className="textLink">Open calendar →</Link></div>
          <div className="upcomingList">{upcoming.length ? upcoming.map((event) => <Link className="upcomingRow" href={`/events/${event.id}?mode=review`} key={event.id}><div className="dateTile"><strong>{new Date(event.start_at!).getDate()}</strong><span>{new Date(event.start_at!).toLocaleDateString("en-US", { month: "short" })}</span></div><div><strong>{event.title}</strong><span>{event.venue_name || "Venue not set"}</span></div><span className={`statusPill status-${event.status}`}>{event.status}</span></Link>) : <p className="mutedText">No upcoming events yet.</p>}</div>
        </article>

        <article className="panel">
          <div className="sectionHeading"><div><p className="eyebrow">Connected ecosystem</p><h2>Publishing channels</h2></div><Link href="/settings/connections" className="textLink">Connections →</Link></div>
          <div className="destinationList">{destinations.map((destination) => <div className="destinationRow" key={destination}><span className="destinationDot" /><strong>{destination}</strong><small>Ready to validate / publish</small></div>)}</div>
        </article>
      </section>
    </main>
  );
}
