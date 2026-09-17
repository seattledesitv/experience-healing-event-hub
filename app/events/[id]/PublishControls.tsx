"use client";

import { useMemo, useState } from "react";

type Publication = { channel: string; enabled: boolean; status: string; external_url: string | null; last_error: string | null };
type Props = { eventId: string; publications: Publication[]; selectedChannels: string[] };
type WritableChannel = "facebook" | "instagram" | "linkedin" | "eventbrite" | "wix" | "google_business";
type DraftChannel = "eventbrite" | "wix";
type LifecycleChannel = "eventbrite" | "wix" | "google_business";

const channels = [
  { id: "facebook", label: "Facebook", draftSupported: false, lifecycle: false },
  { id: "instagram", label: "Instagram", draftSupported: false, lifecycle: false },
  { id: "linkedin", label: "LinkedIn", draftSupported: false, lifecycle: false },
  { id: "eventbrite", label: "Eventbrite", draftSupported: true, lifecycle: true },
  { id: "wix", label: "Wix", draftSupported: true, lifecycle: true },
  { id: "google_business", label: "Google Business", draftSupported: false, lifecycle: true },
] as const;

export default function PublishControls({ eventId, publications, selectedChannels }: Props) {
  const [rows, setRows] = useState(publications.filter((item) => item.channel !== "humanitix"));
  const [publishing, setPublishing] = useState<string | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const publicationMap = useMemo(() => new Map(rows.map((item) => [item.channel, item])), [rows]);

  function updateChannel(channel: string, updates: Partial<Publication>) { setRows((current) => current.some((item) => item.channel === channel) ? current.map((item) => item.channel === channel ? { ...item, ...updates } : item) : [...current, { channel, enabled: true, status: "pending", external_url: null, last_error: null, ...updates }]); }

  async function runChannel(channel: WritableChannel, action: "create" | "update" | "delete" = "create", ask = true) {
    const label = channels.find((item) => item.id === channel)?.label || channel; const external = publicationMap.get(channel); const actualAction = action === "create" && (external?.external_url || external?.status === "published") ? "update" : action;
    if (ask) { const isDraft = channel === "eventbrite" || channel === "wix"; const warning = actualAction === "delete" ? `Delete the ${label} external item? The master event remains in this Hub.` : isDraft ? `${actualAction === "update" ? "Update" : "Create"} the ${label} draft? This does not intentionally publish the event live.` : `${actualAction === "update" ? "Update" : "Publish"} this event LIVE on ${label}? This creates or changes public content.`; if (!window.confirm(warning)) return false; }
    setPublishing(`${channel}:${actualAction}`); setMessage(""); setError(""); if (actualAction !== "delete") updateChannel(channel, { status: "publishing", last_error: null });
    try { const response = await fetch(`/api/publish/${channel}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, action: actualAction }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || `${label} operation failed.`);
      if (actualAction === "delete") { updateChannel(channel, { status: "pending", external_url: null, last_error: null }); setMessage(`${label} external item deleted. The Hub event was kept.`); }
      else { const isDraft = channel === "eventbrite" || channel === "wix"; updateChannel(channel, { status: isDraft ? "draft" : "published", external_url: payload.url || external?.external_url || null, last_error: null }); setMessage(`${label} ${isDraft ? "draft" : "live post"} ${payload.action === "updated" ? "updated" : "created"} successfully.`); }
      return true;
    } catch (publishError) { const text = publishError instanceof Error ? publishError.message : `${label} operation failed.`; updateChannel(channel, { status: "failed", last_error: text }); setError(text); return false; } finally { setPublishing(null); }
  }

  async function createDrafts() {
    const selectedDrafts = channels.filter((item) => item.draftSupported && selectedChannels.includes(item.id)).map((item) => item.id as DraftChannel);
    if (!selectedDrafts.length) { setMessage("No selected destination supports API drafts. Facebook, Instagram, LinkedIn and Google Business are live-only and were NOT published."); return; }
    if (!window.confirm(`Create TEST DRAFTS only on ${selectedDrafts.map((id) => channels.find((c) => c.id === id)?.label).join(" and ")}? Live-only destinations will be skipped.`)) return;
    const results: string[] = []; for (const channel of selectedDrafts) { const ok = await runChannel(channel, "create", false); results.push(`${channels.find((c) => c.id === channel)?.label}: ${ok ? "draft ready" : "failed"}`); }
    setMessage(`Draft test finished. ${results.join(" · ")}. Live-only destinations were not touched.`);
  }

  async function publishLiveSelected() {
    const liveChannels = channels.filter((item) => !item.draftSupported && selectedChannels.includes(item.id)).map((item) => item.id as WritableChannel);
    if (!liveChannels.length) { setMessage("No selected live-publishing destinations. Eventbrite and Wix remain in draft workflow."); return; }
    const names = liveChannels.map((id) => channels.find((c) => c.id === id)?.label).join(", ");
    if (!window.confirm(`PUBLISH LIVE now to: ${names}? This creates real public content. Eventbrite and Wix drafts are not made live by this button.`)) return;
    const results: string[] = []; for (const channel of liveChannels) { const row = publicationMap.get(channel); if (row?.status === "published" || row?.external_url) { results.push(`${channels.find((c) => c.id === channel)?.label}: already published`); continue; } const ok = await runChannel(channel, "create", false); results.push(`${channels.find((c) => c.id === channel)?.label}: ${ok ? "published" : "failed"}`); }
    setMessage(`Live publishing finished. ${results.join(" · ")}.`);
  }

  return <>
    <p className="eyebrow">Publishing destinations</p><h2>Test first, then publish</h2>
    <div className="heroActions"><button className="secondaryButton" type="button" disabled={publishing !== null} onClick={createDrafts}>{publishing ? "Working..." : "1. Create Test Drafts"}</button><button className="primaryButton" type="button" disabled={publishing !== null} onClick={publishLiveSelected}>{publishing ? "Working..." : "2. Publish Live"}</button></div>
    <div className="publishNotice"><strong>Safe test mode</strong><p><b>Test Drafts</b> only creates drafts on Eventbrite and Wix. Facebook, Instagram, LinkedIn and Google Business do not have a safe draft operation in this Hub, so they are skipped. <b>Publish Live</b> is a separate confirmed action for those live-only destinations.</p></div>
    <div className="publishList">{channels.map((channel) => { const publication = publicationMap.get(channel.id); const enabled = selectedChannels.includes(channel.id); const status = publication?.status || (enabled ? "pending" : "not_selected"); const hasExternal = Boolean(publication?.external_url) || status === "published" || status === "draft"; const isSocial = channel.id === "facebook" || channel.id === "instagram" || channel.id === "linkedin"; return <div className="publishChannel" key={channel.id}>
      <div className="publishRow"><div><strong>{channel.label}</strong><small>{enabled ? channel.draftSupported ? "Selected · Draft supported" : "Selected · Live only" : "Not selected"}</small></div><span className={`statusPill status-${status}`}>{status.replaceAll("_", " ")}</span></div>
      {publication?.last_error ? <p className="channelError">{publication.last_error}</p> : null}{publication?.external_url ? <a className="secondaryButton inlineButton smallButton" href={publication.external_url} target="_blank" rel="noreferrer">View external</a> : null}
      {enabled && channel.draftSupported ? <div className="heroActions"><button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel(channel.id as DraftChannel, hasExternal ? "update" : "create")}>{publishing?.startsWith(channel.id) ? "Working..." : hasExternal ? "Update Draft" : "Create Test Draft"}</button>{hasExternal ? <button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel(channel.id as DraftChannel, "delete")}>Delete Draft</button> : null}</div> : null}
      {enabled && !channel.draftSupported && !hasExternal ? <button className="primaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel(channel.id as WritableChannel)}>{publishing?.startsWith(channel.id) ? "Working..." : `Publish LIVE to ${channel.label}`}</button> : null}
      {enabled && channel.id === "facebook" && hasExternal ? <button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel("facebook", "delete")}>Delete from Facebook</button> : null}
      {enabled && channel.id === "instagram" && hasExternal ? <small className="mutedText">Published Instagram content must be removed directly in Instagram.</small> : null}
      {enabled && channel.id === "google_business" && hasExternal ? <div className="heroActions"><button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel("google_business", "update")}>Update Live Post</button><button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel("google_business", "delete")}>Delete Live Post</button></div> : null}
      {enabled && channel.id === "linkedin" && hasExternal ? <small className="mutedText">This Hub currently treats the LinkedIn post as live content; use LinkedIn for manual removal if needed.</small> : null}
    </div>; })}</div>
    {error ? <p className="formError publishFeedback">{error}</p> : null}{message ? <p className="formSuccess publishFeedback">{message}</p> : null}
    <div className="publishNotice"><strong>Recommended test sequence</strong><p>Create Event → Save Draft → Review → Create Test Drafts → inspect Wix/Eventbrite → Delete Drafts → then Publish Live to the live-only destinations when ready.</p></div>
  </>;
}
