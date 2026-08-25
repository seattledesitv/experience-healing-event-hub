"use client";

import { useState } from "react";
import Link from "next/link";

type CheckState = { loading: boolean; ok: boolean | null; message: string };
const initial: CheckState = { loading: false, ok: null, message: "Not checked yet" };
type Channel = "facebook" | "instagram" | "linkedin" | "wix" | "eventbrite";

export default function ConnectionsPage() {
  const [facebook, setFacebook] = useState<CheckState>(initial);
  const [instagram, setInstagram] = useState<CheckState>(initial);
  const [linkedin, setLinkedin] = useState<CheckState>(initial);
  const [wix, setWix] = useState<CheckState>(initial);
  const [eventbrite, setEventbrite] = useState<CheckState>(initial);

  async function validate(channel: Channel) {
    const setter = channel === "facebook" ? setFacebook : channel === "instagram" ? setInstagram : channel === "linkedin" ? setLinkedin : channel === "wix" ? setWix : setEventbrite;
    setter({ loading: true, ok: null, message: "Checking connection..." });
    try {
      const response = await fetch(`/api/connections/${channel}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.connected) throw new Error(payload.error || "Connection validation failed.");
      let label = "Connected";
      if (channel === "facebook") label = `Connected to ${payload.page?.name || "Facebook Page"} (${payload.page?.id || "page"})`;
      else if (channel === "instagram") label = `Connected to @${payload.account?.username || payload.account?.id}`;
      else if (channel === "linkedin") label = `Connected to ${payload.member?.name || payload.member?.email || payload.member?.urn || payload.member?.id || "LinkedIn member"}`;
      else if (channel === "wix") label = `Connected to Wix site ${payload.site?.id || "configured site"}`;
      else if (payload.organization) label = `Connected to ${payload.organization.name || "Eventbrite organization"} (${payload.organization.id})`;
      else label = `Connected to Eventbrite ${payload.user?.name || "account"}`;
      setter({ loading: false, ok: true, message: label });
    } catch (error) {
      setter({ loading: false, ok: false, message: error instanceof Error ? error.message : "Connection validation failed." });
    }
  }

  const cards = [
    { id: "facebook" as const, group: "Social", title: "Facebook", description: "Checks the configured Experience Healing Facebook Page access token.", state: facebook },
    { id: "instagram" as const, group: "Social", title: "Instagram", description: "Checks the configured Instagram professional account and Instagram Login access token.", state: instagram },
    { id: "linkedin" as const, group: "Social", title: "LinkedIn", description: "Checks the authenticated LinkedIn profile and publishing access token.", state: linkedin },
    { id: "wix" as const, group: "Ticketing & events", title: "Wix Events", description: "Checks the configured Experience Healing Wix site and Wix Events API access.", state: wix },
    { id: "eventbrite" as const, group: "Ticketing & events", title: "Eventbrite", description: "Checks the configured Eventbrite token and organization access.", state: eventbrite },
  ];

  return (
    <main className="shell">
      <section className="hero compactHero">
        <div><p className="eyebrow">Settings</p><h1>Connections</h1><p className="lede">Keep only the channels actively used by the Event Hub and validate them from one place.</p></div>
        <Link className="secondaryButton inlineButton" href="/dashboard">Back to dashboard</Link>
      </section>
      <section className="panel connectionList">
        {cards.map((card) => (
          <article className="connectionCard" key={card.id}>
            <div><p className="eyebrow">{card.group}</p><h2>{card.title}</h2><p>{card.description}</p></div>
            <div className={`connectionStatus ${card.state.ok === true ? "isOk" : card.state.ok === false ? "isError" : ""}`}>{card.state.message}</div>
            <button className="primaryButton" type="button" onClick={() => validate(card.id)} disabled={card.state.loading}>{card.state.loading ? "Checking..." : `Validate ${card.title}`}</button>
          </article>
        ))}
      </section>
    </main>
  );
}
