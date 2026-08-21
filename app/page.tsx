const channels = ["Instagram", "LinkedIn", "Eventbrite", "Humanitix", "Wix"];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Experience Healing</p>
        <h1>Event Publishing Hub</h1>
        <p className="lede">
          Create an event once, manage its media, and publish it across every connected channel from one place.
        </p>
        <div className="actions">
          <a className="primary" href="/events/new">Create Event</a>
          <a className="secondary" href="/dashboard">Open Dashboard</a>
        </div>
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">Publishing destinations</p>
          <h2>One source of truth</h2>
        </div>
        <div className="channelGrid">
          {channels.map((channel) => (
            <article className="channel" key={channel}>
              <span className="dot" />
              <strong>{channel}</strong>
              <small>Connector planned</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
