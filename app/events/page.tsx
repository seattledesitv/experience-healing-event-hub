"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function EventsPage() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState(monthKey(new Date()));
  const [view, setView] = useState<"list" | "calendar">(searchParams.get("view") === "calendar" ? "calendar" : "list");

  useEffect(() => {
    async function loadEvents() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { window.location.href = "/login"; return; }
        const { data, error: queryError } = await supabase.from("events").select("id,title,start_at,venue_name,city,status,cover_image_url,updated_at").order("start_at", { ascending: true, nullsFirst: false });
        if (queryError) throw queryError;
        setEvents(data ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load events");
      } finally { setLoading(false); }
    }
    loadEvents();
  }, []);

  const filtered = useMemo(() => events.filter((event) => {
    const searchHit = !query || [event.title, event.venue_name, event.city].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase());
    const statusHit = status === "all" || event.status === status;
    const monthHit = !month || (event.start_at && monthKey(new Date(event.start_at)) === month);
    return searchHit && statusHit && monthHit;
  }), [events, query, status, month]);

  const calendarDays = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(year, monthNumber - 1, 1);
    const count = new Date(year, monthNumber, 0).getDate();
    const cells: Array<{ day: number | null; events: EventRow[] }> = [];
    for (let i = 0; i < first.getDay(); i++) cells.push({ day: null, events: [] });
    for (let day = 1; day <= count; day++) {
      const dayEvents = filtered.filter((event) => event.start_at && new Date(event.start_at).getDate() === day);
      cells.push({ day, events: dayEvents });
    }
    while (cells.length % 7) cells.push({ day: null, events: [] });
    return cells;
  }, [filtered, month]);

  return (
    <main className="shell appShellPage">
      <section className="pageHeader">
        <div><p className="eyebrow">Event Studio</p><h1>Events</h1><p className="lede">Plan, review, filter and publish every Experience Healing event from one workspace.</p></div>
        <Link className="primaryButton inlineButton" href="/events/new">+ Create Event</Link>
      </section>

      <section className="panel eventToolbarPanel">
        <div className="viewToggle">
          <button className={view === "list" ? "viewButton active" : "viewButton"} onClick={() => setView("list")}>List</button>
          <button className={view === "calendar" ? "viewButton active" : "viewButton"} onClick={() => setView("calendar")}>Calendar</button>
        </div>
        <div className="eventFilters">
          <input aria-label="Search events" placeholder="Search events, venue or city…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="publishing">Publishing</option><option value="published">Published</option><option value="archived">Archived</option></select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="secondaryButton" type="button" onClick={() => { setQuery(""); setStatus("all"); setMonth(monthKey(new Date())); }}>Reset</button>
        </div>
      </section>

      {loading ? <section className="panel"><p>Loading events...</p></section> : null}
      {error ? <section className="panel"><p className="formError">{error}</p></section> : null}

      {!loading && !error && view === "list" ? (
        <section className="panel">
          <div className="sectionHeading"><div><p className="eyebrow">Filtered results</p><h2>{filtered.length} event{filtered.length === 1 ? "" : "s"}</h2></div></div>
          {filtered.length === 0 ? <div className="emptyState"><h2>No matching events</h2><p>Adjust the filters or create a new event.</p></div> : null}
          <div className="eventList">{filtered.map((event) => (
            <article className="eventCard" key={event.id}>
              {event.cover_image_url ? <img className="eventCardImage" src={event.cover_image_url} alt="" /> : <div className="eventCardImage placeholderImage">No image</div>}
              <div className="eventCardBody"><div className="eventCardTopline"><span className={`statusPill status-${event.status}`}>{event.status}</span><small>Updated {formatDate(event.updated_at)}</small></div><h2>{event.title}</h2><p>{formatDate(event.start_at)}</p><p>{[event.venue_name, event.city].filter(Boolean).join(" · ") || "Location not set"}</p><div className="cardActions"><Link className="secondaryButton inlineButton" href={`/events/${event.id}`}>Edit</Link><Link className="primaryButton inlineButton" href={`/events/${event.id}?mode=review`}>Review</Link></div></div>
            </article>
          ))}</div>
        </section>
      ) : null}

      {!loading && !error && view === "calendar" ? (
        <section className="panel calendarPanel">
          <div className="calendarHeader"><div><p className="eyebrow">Calendar view</p><h2>{new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2></div><span className="countBadge">{filtered.length} scheduled</span></div>
          <div className="calendarWeekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendarGrid">{calendarDays.map((cell, index) => <div className={cell.day ? "calendarCell" : "calendarCell empty"} key={index}>{cell.day ? <><strong className="calendarDay">{cell.day}</strong><div className="calendarEvents">{cell.events.map((event) => <Link href={`/events/${event.id}?mode=review`} className="calendarEvent" key={event.id}><span>{event.title}</span><small>{event.start_at ? new Date(event.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}</small></Link>)}</div></> : null}</div>)}</div>
        </section>
      ) : null}
    </main>
  );
}
