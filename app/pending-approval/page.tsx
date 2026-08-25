import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <main className="authPage">
      <section className="authBrandPanel">
        <div className="brandMark large">EH</div>
        <p className="eyebrow">Experience Healing</p>
        <h1>Access pending</h1>
        <p>Your account is registered, but an existing super admin still needs to approve Event Hub access.</p>
        <div className="healingTagline">Your account stays secure while approval is pending.</div>
      </section>
      <section className="authCardWrap">
        <div className="panel authForm">
          <div><p className="eyebrow">Approval required</p><h2>Almost there</h2></div>
          <p className="mutedText">Once approved, sign in again and you will be able to manage events and publishing destinations.</p>
          <Link className="primaryButton inlineButton fullButton" href="/login">Return to sign in</Link>
        </div>
      </section>
    </main>
  );
}
