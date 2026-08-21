# Experience Healing Event Hub

A centralized event publishing platform for Experience Healing.

## Goal

Create an event once, then publish or sync it to multiple destinations including:

- Instagram
- LinkedIn
- Eventbrite
- Humanitix
- Wix

The platform will also track per-channel publishing status, errors, external IDs, and links.

## Planned stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase for authentication and relational data
- Cloudflare R2 for event images and media
- Vercel for hosting

## Core model

Experience Healing remains the source of truth for each event. Each external platform is implemented as a publisher adapter so new destinations can be added without redesigning the event model.

## Initial workflow

1. Create or edit an event.
2. Upload event artwork/media to Cloudflare R2.
3. Select publishing destinations.
4. Preview channel-specific content.
5. Publish selected channels.
6. Track success, external URL/ID, and retryable failures.

## Environment setup

Copy `.env.example` to `.env.local` and provide the required credentials. Never commit real secrets.

## Deployment

The application is intended to deploy on Vercel from the `main` branch.
