# MatchaDex

MatchaDex is a map-first cafe discovery app focused on matcha and coffee shops, with reviews, favorites, and user profiles.

## Demo

- https://matchadex.vercel.app/

## Tech Stack

- Next.js (App Router)
- TypeScript
- Prisma ORM
- Supabase (Postgres + Auth)
- Tailwind CSS
- Mapbox
- Vercel

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN`
- `GOOGLE_PLACES_API_KEY`

3. Run database migrations:

```bash
npx prisma migrate dev
```

4. Start the app:

```bash
npm run dev
```

## Import Cafes

```bash
npm run import:cafes
```

Manual cafes can be added in `scripts/manualCafes.json`.

## Screenshots

- Add screenshots here
