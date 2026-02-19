# MatchaDex

MatchaDex is a full-stack Next.js App Router app for discovering, reviewing, and ranking matcha cafes.

## Stack

- Next.js App Router
- TypeScript
- Prisma ORM
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Mapbox GL JS
- Tailwind CSS

## Features

- Email/password auth (Supabase Auth)
- Cafe discovery with city filter, search, sort, pagination
- Yelp-style split layout (scrollable list + interactive map)
- Cafe detail pages with reviews and favorites
- Review create/update (one review per user per cafe)
- Review owner-only edit/delete
- Admin review deletion via allowlist emails
- User profile with reviews + favorites
- Leaderboard page (top cafes by rating)
- Cafe photo upload/listing via Supabase Storage
- Unit tests for core API routes

## Environment Variables

Copy `.env.example` to `.env` and set real values.

Required variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `MAPBOX_PUBLIC_TOKEN`
- `SUPABASE_PHOTOS_BUCKET` (default: `cafe-photos`)
- `MONITORING_WEBHOOK_URL` (optional)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npx prisma generate
```

3. Apply local migrations (if needed):

```bash
npx prisma migrate dev
```

4. Seed data:

```bash
npm run db:seed
```

To reseed safely after updating seed data, rerun:

```bash
npm run db:seed
```

The seed uses `upsert` on `googlePlaceId`, so reruns update existing rows instead of duplicating cafes.

5. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Mapbox Setup

1. Create a Mapbox account at `https://account.mapbox.com/`.
2. Create or copy a public access token from **Access tokens**.
3. Set this token in `.env`:

```bash
MAPBOX_PUBLIC_TOKEN=pk.your_public_token
```

4. Restart the Next.js server after updating env vars.

## Map UX Behavior

- `/cafes` uses one shared map on the right and a scrollable cafe list on the left.
- The list supports search, metro filter, and sort.
- Clicking a cafe in the list selects it, highlights its marker, and recenters the map.
- Clicking a marker selects the cafe and scrolls the left list to that cafe card.
- Marker hover shows a small cafe-name tooltip.
- If the current filter has no mappable cafes, the map shows a friendly empty message.

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build (webpack mode)
- `npm run start` - run production server
- `npm run lint` - run ESLint
- `npm run test` - run Vitest
- `npm run db:migrate:deploy` - apply production migrations
- `npm run db:seed` - run Prisma seed script

## API Routes

### Auth

- `GET /api/auth/me`
  - Returns current session user info.
- `POST /api/auth/logout`
  - Signs out current user.

### Cafes

- `GET /api/cafes`
  - Query params:
    - `city` (optional)
    - `page` (optional, default `1`)
    - `pageSize` (optional, default `6`, max `50`)
    - `sort` (`rating_desc`, `rating_asc`, `name_asc`, `name_desc`)
  - Returns paginated cafes with average ratings and `isFavorited`.

- `GET /api/cafes/search`
  - Query params:
    - `q` (required)
    - `city`, `page`, `pageSize`, `sort` (optional)
  - Returns paginated search results with average ratings.

- `GET /api/cafes/[id]`
  - Returns cafe detail, reviews, rating summary, and viewer metadata.

- `GET /api/cafes/[id]/favorite`
  - Returns whether current user has favorited this cafe.

- `POST /api/cafes/[id]/favorite`
  - Requires auth.
  - Creates favorite for current user.

- `DELETE /api/cafes/[id]/favorite`
  - Requires auth.
  - Removes favorite for current user.

- `GET /api/cafes/[id]/photos`
  - Returns public photo list from Supabase Storage bucket.

- `POST /api/cafes/[id]/photos`
  - Requires auth.
  - Uploads image file (max 5MB).

### Reviews

- `POST /api/reviews`
  - Requires auth.
  - Creates/updates current user review for a cafe.

- `DELETE /api/reviews/[id]`
  - Requires auth.
  - Deletes review only if current user owns it.

- `DELETE /api/admin/reviews/[id]`
  - Requires auth.
  - Requires email in `ADMIN_EMAILS` allowlist.
  - Example:

```bash
curl -X DELETE "http://localhost:3000/api/admin/reviews/<review-id>" \
  --cookie "sb-access-token=<token>; sb-refresh-token=<refresh-token>"
```

### Users

- `GET /api/users/[id]`
  - Returns profile data including reviews and favorites.

## Production Deployment (Vercel + Supabase)

1. Ensure environment variables are set in Vercel project settings.
2. Ensure Supabase Storage bucket exists (`cafe-photos`) and permissions are configured.
3. Deploy from `main` branch.
4. Run production migrations:

```bash
npm run db:migrate:deploy
```

5. Optional production seed:

```bash
npm run db:seed
```

## Production Checklist

- `npm run build` passes in CI and local.
- `npm run lint` passes with no errors.
- `npm run test` passes.
- Required env vars are set in Vercel:
  `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `MAPBOX_PUBLIC_TOKEN`,
  `SUPABASE_PHOTOS_BUCKET`, `MONITORING_WEBHOOK_URL` (optional).
- Run migrations safely before serving new code:

```bash
npm run db:migrate:deploy
```

- Seed is rerunnable and safe because cafes are upserted by `googlePlaceId`:

```bash
npm run db:seed
```

- Smoke test key routes after deploy:
  `/cafes`, `/cafes/<id>`, `/users/<id>`, `/api/cafes`, `/api/health`, `/api/test-db`.

## Demo Account Instructions

Use your own Supabase Auth user as demo, or create a dedicated demo account:

1. Open `/auth`.
2. Sign up with demo email and password.
3. Add sample reviews/favorites/photos.
4. Share this account for demo sessions.

Recommended:

- Keep demo user in `ADMIN_EMAILS` only if admin deletion is needed during demos.
- Rotate demo password periodically.

## Testing Status

Current baseline checks:

- `npm run build` passes
- `npm run lint` passes
- `npm run test` passes
- `npm run db:seed` executes successfully
