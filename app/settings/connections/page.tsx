"use client";

import { useState } from "react";
import Link from "next/link";

type CheckState = {
  loading: boolean;
  ok: boolean | null;
  message: string;
};

const initial: CheckState = { loading: false, ok: null, message: "Not checked yet" };

export default function ConnectionsPage() {
  const [instagram, setInstagram] = useState<CheckState>(initial);
  const [linkedin, setLinkedin] = useState<CheckState>(initial);
  const [wix, setWix] = useState<CheckState>(initial);
  const [eventbrite, setEventbrite] = useState<CheckState>(initial);
  const [humanitix, setHumanitix] = useState<CheckState>(initial);

  async function validate(channel: "instagram" | "linkedin" | "wix" | "eventbrite" | "humanitix") {
    const setter = channel === "instagram"
      ? setInstagram
      : channel === "linkedin"
        ? setLinkedin
        : channel === "wix"
          ? setWix
          : channel === "eventbrite"
            ? setEventbrite
            : setHumanitix;

    setter({ loading: true, ok: null, message: "Checking connection..." });

    try {
      const response = await fetch(`/api/connections/${channel}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.connected) {
        throw new Error(payload.error || "Connection validation failed.");
      }

      let label = "Connected";
      if (channel === "instagram") {
        label = `Connected to @${payload.account?.username || payload.account?.id}`;
      } else if (channel === "linkedin") {
        label = `Connected to ${payload.member?.name || payload.member?.email || payload.member?.urn || payload.member?.id || "LinkedIn member"}`;
      } else if (channel === "wix") {
        label = `Connected to Wix site ${payload.site?.id || "configured site"}`;
      } else if (channel === "eventbrite") {
        if (payload.organization) {
          label = `Connected to ${payload.organization.name || "Eventbrite organization"} (${payload.organization.id})`;
        } else if (payload.needsOrganizationSelection) {
          const summary = (payload.organizations || []).map((item: { name?: string; id?: string }) => `${item.name || "Organization"} (${item.id || "no id"})`).join(", ");
          label = `Connected. Choose Eventbrite organization: ${summary}`;
        } else {
          label = `Connected to Eventbrite ${payload.user?.name || "account"}`;
        }
      } else {
        label = `Connected to Humanitix${typeof payload.eventCount === "number" ? ` — ${payload.eventCount} event${payload.eventCount === 1 ? "" : "s"} visible` : ""}`;
      }

      setter({ loading: false, ok: true, message: label });
    } catch (error) {
      setter({
        loading: false,
        ok: false,
        message: error instanceof Error ? error.message : "Connection validation failed.",
      });
    }
  }

  return (
    <main className="shell">
      <section className="hero compactHero">
        <p className="eyebrow">Settings</p>
        <h1>Connections</h1>
        <p className="lede">Validate each destination before publishing is enabled.</p>
        <div className="heroActions">
          <Link className="secondaryButton inlineButton" href="/dashboard">Back to dashboard</Link>
        </div>
      </section>

      <section className="panel connectionList">
        <article className="connectionCard">
          <div>
            <p className="eyebrow">Social</p>
            <h2>Instagram</h2>
            <p>Checks the configured Instagram professional account and Meta access token.</p>
          </div>
          <div className={`connectionStatus ${instagram.ok === true ? "isOk" : instagram.ok === false ? "isError" : ""}`}>{instagram.message}</div>
          <button className="primaryButton" type="button" onClick={() => validate("instagram")} disabled={instagram.loading}>
            {instagram.loading ? "Checking..." : "Validate Instagram"}
          </button>
        </article>

        <article className="connectionCard">
          <div>
            <p className="eyebrow">Social</p>
            <h2>LinkedIn</h2>
            <p>Checks the authenticated LinkedIn member profile and access token.</p>
          </div>
          <div className={`connectionStatus ${linkedin.ok === true ? "isOk" : linkedin.ok === false ? "isError" : ""}`}>{linkedin.message}</div>
          <button className="primaryButton" type="button" onClick={() => validate("linkedin")} disabled={linkedin.loading}>
            {linkedin.loading ? "Checking..." : "Validate LinkedIn"}
          </button>
        </article>

        <article className="connectionCard">
          <div>
            <p className="eyebrow">Events</p>
            <h2>Wix</h2>
            <p>Checks the configured Experience Healing Wix site and Wix Events API access.</p>
          </div>
          <div className={`connectionStatus ${wix.ok === true ? "isOk" : wix.ok === false ? "isError" : ""}`}>{wix.message}</div>
          <button className="primaryButton" type="button" onClick={() => validate("wix")} disabled={wix.loading}>
            {wix.loading ? "Checking..." : "Validate Wix"}
          </button>
        </article>

        <article className="connectionCard">
          <div>
            <p className="eyebrow">Events</p>
            <h2>Eventbrite</h2>
            <p>Checks the configured Eventbrite private token and discovers the organizations available to the account.</p>
          </div>
          <div className={`connectionStatus ${eventbrite.ok === true ? "isOk" : eventbrite.ok === false ? "isError" : ""}`}>{eventbrite.message}</div>
          <button className="primaryButton" type="button" onClick={() => validate("eventbrite")} disabled={eventbrite.loading}>
            {eventbrite.loading ? "Checking..." : "Validate Eventbrite"}
          </button>
        </article>

        <article className="connectionCard">
          <div>
            <p className="eyebrow">Events</p>
            <h2>Humanitix</h2>
            <p>Checks the configured Humanitix public API key and confirms read-only event access.</p>
          </div>
          <div className={`connectionStatus ${humanitix.ok === true ? "isOk" : humanitix.ok === false ? "isError" : ""}`}>{humanitix.message}</div>
          <button className="primaryButton" type="button" onClick={() => validate("humanitix")} disabled={humanitix.loading}>
            {humanitix.loading ? "Checking..." : "Validate Humanitix"}
          </button>
        </article>
      </section>
    </main>
  );
}
