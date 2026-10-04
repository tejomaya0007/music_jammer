# Going live

This is your checklist. Nothing here has been done for you: no Supabase project was created, nothing was deployed, and no secrets are in the repo.

## 1. Create the Supabase project

1. Go to supabase.com, create a project (free plan is fine), and pick the region closest to you.
2. Wait for it to finish provisioning.

## 2. Enable anonymous sign-ins

1. Dashboard → **Authentication** → **Sign In / Providers**.
2. Turn on **Allow anonymous sign-ins**. The app will not work without this.

## 3. Run the schema

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the whole of `schema.sql` and run it once.
3. Check that it finishes with no errors. The file has been tested against Postgres in PGlite, but it has not yet run on a real Supabase project. If a statement fails, the error message names it. Fix that statement and rerun. Tell me about it so I can add a test for it.
4. Optional: enable `pg_cron` (Database → Extensions), then run the commented cleanup job at the bottom of `schema.sql` so abandoned rooms are deleted after 24 hours.

## 4. Get the keys

1. Dashboard → **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon / publishable** key.
3. Do not copy the `service_role` key. The app never needs it, and it must stay secret.

## 5. Set the environment variables

Locally, create `.env` from `.env.example`:

```
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_PLAYER=youtube
```

Then test on your own computer with `npm run dev` before you deploy.

On the hosting provider, set the same variables (`VITE_BACKEND`, `VITE_PLAYER`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the project's environment settings for **production**. Vite bakes them into the build, so redeploy after changing them.

## 6. Deploy to Vercel (static hosting)

The app is a static site, so any static host works. Vercel steps:

1. Push this repo to GitHub (or drag the folder into Vercel).
2. Vercel → **Add New Project** → import the repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Add the four environment variables from step 5.
5. Deploy. Vercel gives you an HTTPS URL. HTTPS is required for the install prompt and the service worker.
6. No routing rules are needed. The share link uses a query string (`/?join=CODE`).

Other static hosts (Netlify, Cloudflare Pages) work the same way.

## 7. Install on each friend's phone

**Android (Brave or Chrome):** open the site → menu (⋮) → **Install app** or **Add to Home screen**. The icon opens full screen with no browser bar.

**iPhone (Safari):** open the site → Share → **Add to Home Screen**. Note that iOS is stricter about background audio (see section 8).

Each friend opens the site once while online so the app and its offline shell are cached. After that, every update arrives the next time they open the app.

## 8. Real-phone checks (what the automated tests could not cover)

The automated tests use a fake video player, so they cannot prove real playback. Check these on real devices before you rely on the app:

**Background play in Brave on Android**
1. Brave → Settings → **Background play** (or **Play in background**), turned on.
2. Start a jam, play a song, lock the screen, and wait 10 minutes.
3. Expected: the song keeps playing, and the lock screen shows the title and artwork with working previous, play/pause, and next buttons.
4. iPhone: expect playback to stop when the screen locks. This is a platform limit, so note it and decide whether that's acceptable.

**Sync drift**
1. Put two phones in the same room, in different places if you can (or one on Wi-Fi and one on mobile data).
2. Play a song for 5 minutes.
3. Expected: the two players stay within about one second of each other. Check the seek bar time on both, or listen for an echo.
4. If the drift is over 1 second, tell me the rough numbers and the networks used.

**Other things to try**
- Tap "Join in" on each phone. Without it, the video stays silent (browser rule).
- Paste a private or age-restricted video link. Expected: rejected on add, with "Can't play that video here".
- Close a friend's tab for 45 seconds with the host still in the room. Expected: the host role moves to the next person.
- Share the room link with a friend who has never opened the app. Expected: they land on the join screen with the code filled in.

## 9. Known limits to remember

- A free Supabase project pauses after about a week without activity. Open the dashboard to resume it.
- Remote friends will not be sample-accurate (about 0.3 to 1 second apart). Fine for listening together.
- Anyone with the link can join until the room is full (10) or closed.
- Room creation is not rate-limited. If the anon key leaks, someone could create many rooms. Add a limit later if needed.
