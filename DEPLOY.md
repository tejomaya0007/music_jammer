# Production: Supabase + Vercel

Status: prepared, not deployed. Jam Room needs its **own** Supabase project (do not reuse another app's project).

## What is already in the repo
- `supabase/migrations/20260104000000_jam_room_init.sql`: the schema (same as `schema.sql`, the source of truth).
- `vercel.json`: Vite build, `dist/` output, no-cache headers for the service worker and manifest.
- `.env.example`: the four variables. Real values go in Vercel and in a local `.env` (never committed).
- The Supabase CLI is a dev dependency (`npx supabase`).

## 1. Supabase (new project)
```bash
npx supabase projects create jam-room --org-id <ORG_ID> --region ap-south-1 --db-password '<strong password>'
npx supabase link --project-ref <NEW_REF>
npx supabase db push            # applies supabase/migrations
```
Then in the dashboard: **Authentication → Sign In / Providers → Allow anonymous sign-ins: ON**.
Copy **Project URL** and the **anon public** key (Project Settings → API). Never use the service role key in the app.

## 2. Vercel
```bash
npx vercel login                # one-time, interactive
npx vercel link                 # creates the project
npx vercel env add VITE_BACKEND production        # value: supabase
npx vercel env add VITE_PLAYER production         # value: youtube
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod
```
Vite bakes the variables in at build time, so redeploy after changing them.

## 3. Check after deploy
- Open the Vercel URL on a phone. Create a room, join from a second device, play a song.
- Background play, lock-screen controls, and sync drift must be checked on real devices (see the phone checks in the earlier list).
- Install prompt: Chrome/Brave menu → Install app.

## Rollback
`npx vercel rollback` (previous deployment). Database: migrations are forward-only; keep a backup before `db push` on a populated project.
