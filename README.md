# MatchaDex

Screenshot: *(add product screenshot here)*

A production-focused cafe discovery app with map-first browsing, reviews, and moderation.

## Live Demo

- https://matchadex.vercel.app

## Features

- Cafe search
- Map view
- Reviews CRUD
- Admin delete
- Auth
- Weighted rating sort
- Popularity sort
- User profile page

## Authentication

MatchaDex uses Google OAuth via Supabase.
No email/password accounts supported.

## Tech Stack

- Next.js App Router
- Prisma + Supabase Postgres
- Mapbox
- Tailwind CSS
- Vercel

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (see below).

3. Run migrations:

```bash
npx prisma migrate dev
```

4. (Optional) Seed cafes:

```bash
npm run db:seed
```

5. Start development server:

```bash
npm run dev
```

## Required Environment Variables

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN`
- `GOOGLE_PLACES_API_KEY`

## Deployment

1. Push to `main`.
2. Vercel auto-deploys.
3. Run migrations on production DB:

```bash
npm run db:migrate:deploy
```

## Production Checklist

- Build passes: `npm run build`
- Migrations applied
- Seed done
- `GET /api/health` works
- `GET /api/test-db` works

## Import Real Cafes

Set Google Places API key and run:

```bash
GOOGLE_PLACES_API_KEY=your_key_here node scripts/importCafes.ts
```
