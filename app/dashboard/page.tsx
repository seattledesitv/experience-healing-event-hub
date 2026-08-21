const channels = ["Instagram", "LinkedIn", "Eventbrite", "Humanitix", "Wix"];

export default function DashboardPage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Publishing overview</h1>
        <p className="lede">Track events, connected destinations, publishing state, and failures from one place.</p>
      </section>
      <section className="panel">
        <div className="channelGrid">
          {channels.map((channel) => (
            <article className="channel" key={channel}>
              <strong>{channel}</strong>
              <small>Not connected yet</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
