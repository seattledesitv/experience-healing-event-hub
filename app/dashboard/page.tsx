import Link from "next/link";

const channels = ["Instagram", "LinkedIn", "Eventbrite", "Humanitix", "Wix"];

export default function DashboardPage() {
  return (
    <main className="shell">
      <section className="hero compactHero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Publishing overview</h1>
          <p className="lede">Track events, connected destinations, publishing state, and failures from one place.</p>
        </div>
        <div className="heroActions">
          <Link className="primaryButton inlineButton" href="/events/new">Create event</Link>
          <Link className="secondaryButton inlineButton" href="/events">Manage events</Link>
          <Link className="secondaryButton inlineButton" href="/settings/connections">Connections</Link>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Destinations</p>
            <h2>Publishing channels</h2>
          </div>
          <small>Validate Instagram and LinkedIn in Connections before publishing is enabled.</small>
        </div>
        <div className="channelGrid">
          {channels.map((channel) => (
            <article className="channel" key={channel}>
              <strong>{channel}</strong>
              <small>Use Connections to validate</small>
            </article>
          ))}
        </div>
      </section>

      <section className="panel workflowPanel">
        <p className="eyebrow">Current workflow</p>
        <h2>Create → Save → Edit → Review</h2>
        <p>The master event workflow is available now. Publishing will be unlocked channel by channel after connection validation.</p>
        <div className="cardActions">
          <Link className="secondaryButton inlineButton" href="/events">Open Event Studio</Link>
          <Link className="secondaryButton inlineButton" href="/settings/connections">Validate Connections</Link>
        </div>
      </section>
    </main>
  );
}
