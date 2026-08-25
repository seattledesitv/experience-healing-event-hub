import Link from "next/link";

const channels = ["Facebook", "Instagram", "LinkedIn", "Eventbrite", "Humanitix", "Wix"];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero brandedHeader">
        <div className="brandMark large">EH</div>
        <p className="eyebrow">Experience Healing</p>
        <h1>Event Publishing Hub</h1>
        <p className="lede">Create an event once, manage its media and details, then coordinate publishing across every connected destination from one calm workspace.</p>
        <div className="actions">
          <Link className="primary" href="/login">Sign in</Link>
          <Link className="secondary" href="/signup">Create account</Link>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHeading"><div><p className="eyebrow">One source of truth</p><h2>Connected publishing</h2></div><small>Manage the master event in the Hub while each external destination keeps its own lifecycle.</small></div>
        <div className="channelGrid">{channels.map((channel) => <article className="channel" key={channel}><span className="destinationDot" /><strong>{channel}</strong><small>Managed from Event Hub</small></article>)}</div>
      </section>
    </main>
  );
}
