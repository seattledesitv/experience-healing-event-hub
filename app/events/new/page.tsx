"use client";

import { useState } from "react";

const channels = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "humanitix", label: "Humanitix" },
  { id: "wix", label: "Wix" },
];

export default function NewEventPage() {
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "instagram",
    "linkedin",
    "wix",
  ]);

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Event Studio</p>
        <h1>Create once. Publish everywhere.</h1>
        <p className="lede">
          Build the master Experience Healing event here, upload one source image to Cloudinary,
          then choose where the event should be published.
        </p>
      </section>

      <form className="panel eventForm">
        <div className="formSection">
          <div>
            <p className="eyebrow">1. Event details</p>
            <h2>Core information</h2>
          </div>
          <label>
            Event title
            <input name="title" placeholder="Sound Healing & Meditation" required />
          </label>
          <label>
            Short description
            <input name="short_description" placeholder="A calming evening of guided healing and sound." />
          </label>
          <label>
            Full description
            <textarea name="description" rows={7} placeholder="Tell guests what to expect..." />
          </label>
          <div className="twoCol">
            <label>
              Starts
              <input name="start_at" type="datetime-local" />
            </label>
            <label>
              Ends
              <input name="end_at" type="datetime-local" />
            </label>
          </div>
        </div>

        <div className="formSection">
          <div>
            <p className="eyebrow">2. Location & registration</p>
            <h2>Where people join</h2>
          </div>
          <label>
            Venue name
            <input name="venue_name" placeholder="Experience Healing Studio" />
          </label>
          <label>
            Address
            <input name="address_line1" placeholder="Street address" />
          </label>
          <div className="threeCol">
            <label>
              City
              <input name="city" />
            </label>
            <label>
              State
              <input name="state" defaultValue="WA" />
            </label>
            <label>
              ZIP
              <input name="postal_code" />
            </label>
          </div>
          <label>
            Registration URL
            <input name="registration_url" type="url" placeholder="https://..." />
          </label>
        </div>

        <div className="formSection">
          <div>
            <p className="eyebrow">3. Media</p>
            <h2>Event image</h2>
          </div>
          <div className="uploadBox">
            <strong>Upload event flyer or photo</strong>
            <span>Cloudinary upload wiring comes next after account credentials are added.</span>
            <input type="file" accept="image/*" disabled />
          </div>
        </div>

        <div className="formSection">
          <div>
            <p className="eyebrow">4. Social copy</p>
            <h2>Customize by channel</h2>
          </div>
          <label>
            Instagram caption
            <textarea name="instagram_caption" rows={5} placeholder="Instagram-ready caption..." />
          </label>
          <label>
            LinkedIn caption
            <textarea name="linkedin_caption" rows={5} placeholder="LinkedIn-ready copy..." />
          </label>
          <label>
            Hashtags
            <input name="hashtags" placeholder="#ExperienceHealing #Wellness #Seattle" />
          </label>
        </div>

        <div className="formSection">
          <div>
            <p className="eyebrow">5. Destinations</p>
            <h2>Select where to publish</h2>
          </div>
          <div className="channelGrid">
            {channels.map((channel) => {
              const selected = selectedChannels.includes(channel.id);
              return (
                <button
                  className={`channel channelButton ${selected ? "selected" : ""}`}
                  type="button"
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                >
                  <strong>{channel.label}</strong>
                  <small>{selected ? "Selected" : "Not selected"}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="formActions">
          <button className="secondaryButton" type="button">Save draft</button>
          <button className="primaryButton" type="button">Review event</button>
        </div>
      </form>
    </main>
  );
}
