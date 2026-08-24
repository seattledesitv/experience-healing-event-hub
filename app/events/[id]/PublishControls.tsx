"use client";

import { useMemo, useState } from "react";

type Publication = {
  channel: string;
  enabled: boolean;
  status: string;
  external_url: string | null;
  last_error: string | null;
};

type Props = {
  eventId: string;
  publications: Publication[];
  selectedChannels: string[];
};

type WritableChannel = "facebook" | "instagram" | "linkedin" | "eventbrite" | "wix";
type LifecycleChannel = "eventbrite" | "wix";

const channels = [
  { id: "facebook", label: "Facebook", publishable: true, lifecycle: false },
  { id: "instagram", label: "Instagram", publishable: true, lifecycle: false },
  { id: "linkedin", label: "LinkedIn", publishable: true, lifecycle: false },
  { id: "eventbrite", label: "Eventbrite", publishable: true, lifecycle: true },
  { id: "humanitix", label: "Humanitix", publishable: false, lifecycle: false },
  { id: "wix", label: "Wix", publishable: true, lifecycle: true },
] as const;

export default function PublishControls({ eventId, publications, selectedChannels }: Props) {
  const [rows, setRows] = useState(publications);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const publicationMap = useMemo(() => new Map(rows.map((item) => [item.channel, item])), [rows]);

  function updateChannel(channel: string, updates: Partial<Publication>) {
    setRows((current) => {
      const found = current.some((item) => item.channel === channel);
      if (!found) return [...current, { channel, enabled: true, status: "pending", external_url: null, last_error: null, ...updates }];
      return current.map((item) => item.channel === channel ? { ...item, ...updates } : item);
    });
  }

  async function runChannel(channel: WritableChannel, action: "create" | "update" | "delete" = "create", ask = true) {
    const label = channels.find((item) => item.id === channel)?.label || channel;
    const external = publicationMap.get(channel);
    const actualAction = action === "create" && external?.external_url ? "update" : action;

    if (ask) {
      const isSocial = channel === "facebook" || channel === "instagram" || channel === "linkedin";
      const warning = actualAction === "delete"
        ? `Delete the ${label} post now? This removes the external post but keeps the master event in this Hub.`
        : isSocial
          ? `Publish this event to ${label} now? This creates a real public post.`
          : `${actualAction === "update" ? "Update" : "Create"} the ${label} event now? Wix/Eventbrite are created as drafts for review.`;
      if (!window.confirm(warning)) return false;
    }

    setPublishing(`${channel}:${actualAction}`);
    setMessage("");
    setError("");
    if (actualAction !== "delete") updateChannel(channel, { status: "publishing", last_error: null });

    try {
      const response = await fetch(`/api/publish/${channel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action: actualAction }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `${label} operation failed.`);

      if (actualAction === "delete") {
        updateChannel(channel, { status: "pending", external_url: null, last_error: null });
        setMessage(`${label} post deleted. The master Hub event was kept.`);
      } else {
        updateChannel(channel, { status: "published", external_url: payload.url || external?.external_url || null, last_error: null });
        const suffix = channel === "eventbrite" || channel === "wix" ? " draft" : " post";
        setMessage(`${label}${suffix} ${payload.action === "updated" ? "updated" : "created"} successfully.`);
      }
      return true;
    } catch (publishError) {
      const text = publishError instanceof Error ? publishError.message : `${label} operation failed.`;
      updateChannel(channel, { status: "failed", last_error: text });
      setError(text);
      return false;
    } finally {
      setPublishing(null);
    }
  }

  async function checkHumanitix() {
    if (!selectedChannels.includes("humanitix")) return;
    setPublishing("humanitix:check");
    setMessage("");
    setError("");
    updateChannel("humanitix", { status: "publishing", last_error: null });

    try {
      const response = await fetch("/api/publish/humanitix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Humanitix check failed.");

      if (payload.matched) {
        updateChannel("humanitix", { status: "published", external_url: payload.url || null, last_error: null });
        setMessage(`Humanitix match found${payload.name ? `: ${payload.name}` : ""}.`);
      } else {
        const text = payload.message || "No matching Humanitix event was found.";
        updateChannel("humanitix", { status: "manual_action_required", external_url: null, last_error: text });
        setMessage(`${text} Create it manually in Humanitix, then check again.`);
      }
    } catch (checkError) {
      const text = checkError instanceof Error ? checkError.message : "Humanitix check failed.";
      updateChannel("humanitix", { status: "failed", last_error: text });
      setError(text);
    } finally {
      setPublishing(null);
    }
  }

  async function publishSelected() {
    const selected = channels.filter((item) => selectedChannels.includes(item.id) && item.publishable).map((item) => item.id as WritableChannel);
    if (!selected.length) return;
    if (!window.confirm("Run all selected writable destinations? Facebook, Instagram and LinkedIn create real public posts; Wix/Eventbrite create drafts for review.")) return;

    const results: string[] = [];
    for (const channel of selected) {
      const row = publicationMap.get(channel);
      if ((channel === "facebook" || channel === "instagram" || channel === "linkedin") && (row?.status === "published" || row?.external_url)) continue;
      const ok = await runChannel(channel, "create", false);
      results.push(`${channel}: ${ok ? "ok" : "failed"}`);
    }
    setMessage(`Selected destinations finished — ${results.join(", ")}.`);
  }

  return (
    <>
      <p className="eyebrow">Publishing destinations</p>
      <h2>Channel readiness</h2>

      <button className="primaryButton" type="button" disabled={publishing !== null} onClick={publishSelected}>
        {publishing ? "Working..." : "Publish / Create Selected"}
      </button>
      <p className="mutedText">Facebook, Instagram and LinkedIn publish publicly. Wix and Eventbrite are created as drafts. Humanitix is read-only/manual.</p>

      <div className="publishList">
        {channels.map((channel) => {
          const publication = publicationMap.get(channel.id);
          const enabled = selectedChannels.includes(channel.id);
          const status = publication?.status || (enabled ? "pending" : "not_selected");
          const hasExternal = Boolean(publication?.external_url) || status === "published";
          const writable = channel.publishable && enabled;
          const isSocial = channel.id === "facebook" || channel.id === "instagram" || channel.id === "linkedin";

          return (
            <div className="publishChannel" key={channel.id}>
              <div className="publishRow">
                <div><strong>{channel.label}</strong><small>{enabled ? "Selected" : "Not selected"}</small></div>
                <span className={`statusPill status-${status}`}>{status.replaceAll("_", " ")}</span>
              </div>

              {publication?.last_error ? <p className="channelError">{publication.last_error}</p> : null}
              {publication?.external_url ? <a className="secondaryButton inlineButton smallButton" href={publication.external_url} target="_blank" rel="noreferrer">View external</a> : null}

              {writable && isSocial && status !== "published" ? (
                <button className="primaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel(channel.id as WritableChannel)}>
                  {publishing?.startsWith(channel.id) ? "Working..." : `Publish to ${channel.label}`}
                </button>
              ) : null}

              {enabled && channel.id === "facebook" && hasExternal ? (
                <div className="heroActions">
                  <button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel("facebook", "delete")}>Delete from Facebook</button>
                </div>
              ) : null}

              {enabled && channel.id === "instagram" && hasExternal ? (
                <div className="heroActions">
                  {publication?.external_url ? <a className="secondaryButton inlineButton smallButton" href={publication.external_url} target="_blank" rel="noreferrer">Open Instagram to delete</a> : null}
                  <small className="mutedText">Instagram publishing API does not expose a supported delete operation for published media, so removal must be done in Instagram.</small>
                </div>
              ) : null}

              {writable && channel.lifecycle ? (
                <div className="heroActions">
                  <button className="primaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel(channel.id as LifecycleChannel, hasExternal ? "update" : "create")}>
                    {publishing?.startsWith(channel.id) ? "Working..." : hasExternal ? `Update ${channel.label}` : `Create ${channel.label} draft`}
                  </button>
                  {hasExternal ? <button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={() => runChannel(channel.id as LifecycleChannel, "delete")}>Delete from {channel.label}</button> : null}
                </div>
              ) : null}

              {enabled && channel.id === "humanitix" ? (
                <div className="heroActions">
                  <button className="secondaryButton smallButton" type="button" disabled={publishing !== null} onClick={checkHumanitix}>
                    {publishing?.startsWith("humanitix") ? "Checking..." : "Check Humanitix"}
                  </button>
                  <small className="mutedText">Read-only: this matches an event already created in Humanitix by title/date.</small>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="formError publishFeedback">{error}</p> : null}
      {message ? <p className="formSuccess publishFeedback">{message}</p> : null}

      <div className="publishNotice">
        <strong>Lifecycle controls are enabled for Facebook, Wix and Eventbrite.</strong>
        <p>Facebook posts can be deleted from the Hub. Instagram posts must be removed manually in Instagram. Social posts are protected from duplicate publishing after a successful post.</p>
      </div>
    </>
  );
}
