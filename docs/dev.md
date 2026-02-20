# MatchaDex Dev Guide

## Local Setup

1. Install dependencies.

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

3. Run migrations.

```bash
npx prisma migrate dev
```

4. (Optional) Seed cafes.

```bash
npm run db:seed
```

5. Run development server.

```bash
npm run dev
```

## Deployment

1. Deploy to Vercel from `main`.
2. Run production migrations.

```bash
npm run db:migrate:deploy
```

## Production Checklist

- `npm run build` passes
- migrations applied
- `GET /api/health` works
- `GET /api/test-db` works

## Cafe Import

Use Google Places import:

```bash
npm run import:cafes
```

Manual overrides can be defined in:

- `scripts/manualCafes.json`

Manual cafe entry shape:

```json
[
  {
    "googlePlaceId": "your-place-id",
    "name": "Cafe Name",
    "city": "LA",
    "latitude": 34.000001,
    "longitude": -118.000001,
    "address": "123 Main St"
  }
]
```
