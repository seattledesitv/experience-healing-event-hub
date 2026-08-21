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

const channels = [
  { id: "instagram", label: "Instagram", publishable: true },
  { id: "linkedin", label: "LinkedIn", publishable: true },
  { id: "eventbrite", label: "Eventbrite", publishable: false },
  { id: "humanitix", label: "Humanitix", publishable: false },
  { id: "wix", label: "Wix", publishable: false },
];

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

  async function publish(channel: "instagram" | "linkedin") {
    const label = channel === "instagram" ? "Instagram" : "LinkedIn";
    if (!window.confirm(`Publish this event to ${label} now? This will create a real public post.`)) return;

    setPublishing(channel);
    setMessage("");
    setError("");
    updateChannel(channel, { status: "publishing", last_error: null });

    try {
      const response = await fetch(`/api/publish/${channel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `${label} publishing failed.`);

      updateChannel(channel, {
        status: "published",
        external_url: payload.url || null,
        last_error: null,
      });
      setMessage(payload.alreadyPublished ? `${label} was already published.` : `${label} published successfully.`);
    } catch (publishError) {
      const text = publishError instanceof Error ? publishError.message : `${label} publishing failed.`;
      updateChannel(channel, { status: "failed", last_error: text });
      setError(text);
    } finally {
      setPublishing(null);
    }
  }

  return (
    <>
      <p className="eyebrow">Publishing destinations</p>
      <h2>Channel readiness</h2>
      <div className="publishList">
        {channels.map((channel) => {
          const publication = publicationMap.get(channel.id);
          const enabled = selectedChannels.includes(channel.id);
          const status = publication?.status || (enabled ? "pending" : "not_selected");
          const canPublish = enabled && channel.publishable && status !== "published";

          return (
            <div className="publishChannel" key={channel.id}>
              <div className="publishRow">
                <div>
                  <strong>{channel.label}</strong>
                  <small>{enabled ? "Selected" : "Not selected"}</small>
                </div>
                <span className={`statusPill status-${status}`}>{status.replaceAll("_", " ")}</span>
              </div>

              {publication?.last_error ? <p className="channelError">{publication.last_error}</p> : null}
              {publication?.external_url && status === "published" ? (
                <a className="secondaryButton inlineButton smallButton" href={publication.external_url} target="_blank" rel="noreferrer">View post</a>
              ) : null}
              {canPublish && (channel.id === "instagram" || channel.id === "linkedin") ? (
                <button
                  className="primaryButton smallButton"
                  type="button"
                  disabled={publishing !== null}
                  onClick={() => publish(channel.id)}
                >
                  {publishing === channel.id ? "Publishing..." : `Publish to ${channel.label}`}
                </button>
              ) : null}
              {enabled && !channel.publishable ? <small className="mutedText">Connector coming next.</small> : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="formError publishFeedback">{error}</p> : null}
      {message ? <p className="formSuccess publishFeedback">{message}</p> : null}

      <div className="publishNotice">
        <strong>Publishing is live for Instagram and LinkedIn.</strong>
        <p>Each destination is published independently. Eventbrite, Wix, and Humanitix remain locked until their connectors are completed.</p>
      </div>
    </>
  );
}
