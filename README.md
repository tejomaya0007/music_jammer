# Jam Room

Listen to YouTube songs together, in sync, from different places. A PWA: open it in Brave or Chrome, add it to your home screen, and it runs full screen. No accounts, no app store, no backend server. The browser talks straight to Supabase.

Design docs: [`context.md`](context.md) (what it does), [`architecture.md`](architecture.md) (how it is built), [`schema.sql`](schema.sql) (database, security rules, and server functions; the source of truth).

Decisions made while building: [`DECISIONS.md`](DECISIONS.md). Test results: [`TEST_REPORT.md`](TEST_REPORT.md). Going live: [`DEPLOY.md`](DEPLOY.md).

## Run it locally

Requirements: Node 20 or newer, npm, and (for the e2e tests) Chromium from Playwright.

```bash
npm install
npx playwright install chromium   # only needed for e2e and PWA tests
```

### Run with the local test backend (no Supabase needed)

The local backend runs the real `schema.sql` in PGlite, so you can try the app on your own machine with no account.

Terminal 1, backend:

```bash
npm run mock:server        # http://127.0.0.1:8787/mock-api
```

Terminal 2, app:

```bash
npm run dev:mock           # http://localhost:5173
```

Open `http://localhost:5173` in two browser windows (or one normal and one private window, so they have separate anonymous users). Start a jam in one, join with the code or link in the other. The fake player is used in this mode, so no video plays; the song titles are "Fake song <id>".

### Run against Supabase

1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Leave `VITE_BACKEND=supabase` and `VITE_PLAYER=youtube`.
2. `npm run dev`, then open `http://localhost:5173`.

Follow [`DEPLOY.md`](DEPLOY.md) for the one-time Supabase setup (anonymous sign-ins and running `schema.sql`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server against Supabase (needs `.env`) |
| `npm run dev:mock` | Vite dev server against the local test backend |
| `npm run mock:server` | Local test backend (PGlite + schema.sql), port 8787 |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve `dist/` on port 4173 (proxies the mock API if running) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate the PWA icons in `public/` |
| `npm test` | All Vitest suites (SQL, unit, component, PWA) |
| `npm run test:sql` | SQL / RPC / RLS tests against `schema.sql` in PGlite |
| `npm run test:unit` | Link parser, sync math, reorder midpoint, clock offset |
| `npm run test:component` | React components (jsdom), recording fake backend |
| `npm run test:pwa` | Production build, manifest, icons, service worker, Lighthouse installability |
| `npm run test:e2e` | Playwright: three friends in three browser contexts |

## Tests

Each suite can run on its own.

- **SQL / RPC / RLS** (`tests/sql/`): runs the real `schema.sql` in PGlite with the shim (`db/shim.sql`). Covers every RPC in the spec, host transfer and takeover, the 200-song cap, stale-version handling, duplicate end reports, chat limits, and that non-members cannot read or write. `npm run test:sql`
- **Unit** (`tests/unit/`): link parser (all URL forms, junk, multiple links), expected-position math, reorder midpoint, clock offset, drift rules. `npm run test:unit`
- **Component** (`tests/component/`): Home, the tap-to-join gate, the seek bar, queue, chat badge, sheets, toasts. The backend is replaced with a recording fake. `npm run test:component`
- **End-to-end** (`tests/e2e/friends.spec.ts`): three browser contexts (three phones). Creates a room, joins by link and by code, checks presence and member counts, pastes links, checks sync after play, pause, seek, next, and previous, drag reorder, chat, host leaves with music still playing, kick, close, reload auto-rejoin, a solo room, and a real 40-second disconnect takeover. The Playwright config starts the mock backend and the Vite dev server itself. `npm run test:e2e`
- **PWA** (`tests/pwa/`): builds the app, serves it with `vite preview`, checks the manifest and icons, confirms the service worker registers in Chromium, and runs Lighthouse's installability audits. `npm run test:pwa`

## Project structure

```
context.md            what the app does
architecture.md       how it is built
schema.sql            Postgres: tables, RLS, RPCs (source of truth)
DEPLOY.md             going live checklist
DECISIONS.md          every judgment call
TEST_REPORT.md        what was tested and what was not

db/
  load.ts             creates a PGlite database with the shim + schema.sql (tests and mock only)
  shim.sql            minimal Supabase stand-in: auth.users, auth.uid(), roles, realtime publication

server/
  mock-server.ts      local test backend: runs RPCs as the signed-in user under RLS, SSE realtime and presence
  start.ts            entry point for the mock server

src/
  main.tsx, App.tsx   entry; Home vs Room; invite link handling
  styles.css          design tokens (colour, type, space) and all styles
  lib/
    api.ts            the only backend surface the UI uses; one function per RPC
    backend/          supabase.ts (production) and mock.ts (local); index.ts picks one from VITE_BACKEND
    config.ts         build-time switches and limits
    link.ts           YouTube link parser
    sync.ts           expected position, clock offset, reorder midpoint, drift rules
    storage.ts        safe localStorage wrappers
    player/           one Player interface; youtube.ts (IFrame API) and fake.ts (tests)
  state/
    roomStore.ts      Zustand store and toasts
    session.ts        session controller: join, rejoin, realtime, heartbeat, clock sync, actions
  hooks/
    usePlayer.ts      connects the player to shared state; drift loop; ended/error reports
    useMediaSession.ts lock-screen controls
  components/         Home, Room, NowPlaying, Queue, Chat, People, parts, icons, Toasts

tests/
  sql/ unit/ component/ pwa/ e2e/   test suites (see above)

scripts/make-icons.mjs  generates the PWA icons without an image library
public/                 icons and favicon
```

## Configuration

| Variable | Values | Default | Used for |
| --- | --- | --- | --- |
| `VITE_BACKEND` | `supabase`, `mock` | `supabase` | Which backend the app talks to |
| `VITE_PLAYER` | `youtube`, `fake` | `youtube` | Real YouTube player or the deterministic test player |
| `VITE_SUPABASE_URL` | URL | none | Supabase project URL (`supabase` mode) |
| `VITE_SUPABASE_ANON_KEY` | key | none | Supabase public key (safe in the browser; security is RLS and the RPCs) |

Set these in `.env` (never commit it). `.env.mock` sets the two mode flags for local testing.
