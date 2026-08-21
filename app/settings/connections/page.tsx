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

  async function validate(channel: "instagram" | "linkedin") {
    const setter = channel === "instagram" ? setInstagram : setLinkedin;
    setter({ loading: true, ok: null, message: "Checking connection..." });

    try {
      const response = await fetch(`/api/connections/${channel}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.connected) {
        throw new Error(payload.error || "Connection validation failed.");
      }

      const label = channel === "instagram"
        ? `Connected to @${payload.account?.username || payload.account?.id}`
        : `Connected to ${payload.member?.name || payload.member?.email || payload.member?.urn || payload.member?.id || "LinkedIn member"}`;

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
          <div className={`connectionStatus ${instagram.ok === true ? "isOk" : instagram.ok === false ? "isError" : ""}`}>
            {instagram.message}
          </div>
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
          <div className={`connectionStatus ${linkedin.ok === true ? "isOk" : linkedin.ok === false ? "isError" : ""}`}>
            {linkedin.message}
          </div>
          <button className="primaryButton" type="button" onClick={() => validate("linkedin")} disabled={linkedin.loading}>
            {linkedin.loading ? "Checking..." : "Validate LinkedIn"}
          </button>
        </article>

        <article className="connectionCard mutedCard">
          <div>
            <p className="eyebrow">Next</p>
            <h2>Eventbrite, Wix & Humanitix</h2>
            <p>These connectors will be added after Instagram and LinkedIn validation succeeds.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
