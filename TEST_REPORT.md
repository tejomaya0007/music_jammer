# Test report

Run on this machine (Windows 11, Node 24, Chromium from Playwright). Every number below comes from a run in this session; nothing is estimated.

## Round 2 status (latest code)

- Lint: clean (0 errors, 0 warnings). Typecheck: clean. Production build: passes.
- E2E: 8 / 8 passed.
- Vitest: 145 / 145 passed (SQL 76, unit 44, component 15, PWA 10).

Still needs a human: play a real song on a phone and listen for sound; check the create-then-open-room flow and the avatar stack on a real phone.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| SQL / RPC / RLS (PGlite + real `schema.sql`) | `npm run test:sql` | **76 / 76 passed** |
| Unit (link parser, sync math, reorder, clock offset, drift) | `npm run test:unit` | **44 / 44 passed** |
| Component (React + Testing Library, jsdom) | `npm run test:component` | **13 / 13 passed** |
| PWA (build, manifest, icons, service worker, install criteria) | `npm run test:pwa` | **10 / 10 passed** |
| End-to-end (Playwright, three browser contexts) | `npm run test:e2e` | **8 / 8 passed** |
| Lint (ESLint) | `npm run lint` | **0 errors, 0 warnings** |
| Typecheck | `npm run typecheck` | **clean** |
| Production build | `npm run build` | **builds** (`dist/`, service worker emitted) |

Total automated: 143 Vitest + 8 Playwright, all passing.

## What was tested

### SQL / RPC / RLS (`tests/sql/`)
Runs the real `schema.sql` in PGlite with the Supabase shim. Each call runs as role `authenticated` with `auth.uid()` set, so RLS and the membership checks are the real ones.

- **create_room**: code format, host and member created, system line, empty name rejected, no signed-in user rejected, name capped at 30.
- **join_room**: bad code, lowercase and spaced code accepted, closed room, full room (10), kicked user blocked, rejoin reuses the row, join line posted once, idle room gives the first person back host.
- **leave_room**: member removed, room keeps playing for others, last person out idles and pauses the room.
- **Host passes**: longest-joined online member takes over on leave; offline members skipped; heartbeat takeover after 40 s silence (checked by aging timestamps); no takeover while host is within 40 s; only the longest-present caller's heartbeat applies it.
- **transfer_host**: host only, target must be a current member, old host loses powers.
- **kick / close**: host only (non-host rejected), host cannot kick self, kick posts a line, close blocks rejoin.
- **Rejoin after everyone offline**: playback frozen where it stopped, paused.
- **add_song**: invalid IDs rejected, autostart on first song only, title fallback and server-built thumbnail, 200-song cap, non-member rejected.
- **remove_song**: current song moves to the next (keeps playing state), last one clears selection, non-current leaves playback alone, stranger rejected.
- **reorder_song**: midpoint positions reorder the list; playing song not interrupted; NaN, Infinity, null rejected.
- **playback**: play starts first song when nothing selected; empty queue error; pause captures position; play resumes from it; seek sets position and clamps negatives; unknown action rejected; non-member rejected.
- **play_song**: jumps to a chosen song.
- **next / prev**: moves by queue order; past the end stops; stale version ignored (double click cannot skip twice); prev restarts after more than 5 s; prev within 5 s goes back; prev on first song restarts; stale prev ignored.
- **song_ended**: auto-advance; duplicate reports harmless; null song id never starts playback; error report posts "Couldn't play ..., skipped"; report for a non-current song ignored; last song ends with nothing selected.
- **send_message**: trimmed, empty ignored, truncated to 500, rate limit 8 per 10 s, non-member rejected.
- **get_server_time**: epoch ms.
- **RLS** (`tests/sql/rls.test.ts`): non-member reads nothing from another room (rooms, songs, messages, members); member reads own room; kicked member loses read access; stranger and member cannot write tables directly (update, insert, delete on all five tables); internal helpers (`_set_current`, `_assert_member`, `_assert_host`, `gen_code`) not callable by a user; anon role has no table access.

Every SQL bug found is listed in DECISIONS.md (decisions 8 to 13) with the test that catches it.

### Unit (`tests/unit/pure.test.ts`)
- Link parser: 15 accepted forms (bare ID, youtu.be with and without scheme and time, watch with and without www, mobile, music, shorts, embed, live, /v/, nocookie embed, spaces); 13 rejected forms (short and long IDs, bad characters, Vimeo, home, search, playlist, empty youtu.be, lookalike domain, random text, Spotify).
- Multiple links: split on spaces, commas and newlines, order and duplicates kept, junk reported separately.
- Expected-position math: advances while playing, holds while paused, never negative.
- Clock offset: lowest round trip wins, serverNow = clientNow + offset, zero when clocks agree, needs a sample.
- Reorder midpoint: between neighbours, top, bottom, empty list.
- Drift rule: no correction within 300 ms; correction over 300 ms; skipped while paused, buffering, or in cool-down.

### Component (`tests/component/ui.test.tsx`)
Home (name required, name remembered, invite code filled and uppercased, DB error shown as-is), tap-to-join gate (shows, unlocks), empty queue prompt, now-playing title and "added by", queue order and current row and duplicate hint, remove calls the RPC, chat unread badge and opening clears it, sheets close on Escape and scrim, toasts time out.

### End-to-end (`tests/e2e/friends.spec.ts`)
Three separate browser contexts (own storage, own anonymous user), phone viewport.

1. **Create, join by link, join by code, presence**: counts show 1, 2, 3 online across all three; a friend closing their tab drops the count to 2.
2. **Pasted links**: three links in one paste reach all three queues in order; a bad link shows "Not a YouTube link" and adds nothing.
3. **Synced transport**: all three tap "Tap to join the music"; all play the same song within 1.5 s; pause from one phone stops all three (position frozen to 0.3 s over 1.2 s); resume; keyboard seek on one phone brings the other two to within 1.5 s; next and previous from different phones show the same song everywhere; drag the third song to the top: everyone sees the new order and the playing song is not interrupted.
4. **Chat**: a message reaches everyone; the other two see an unread badge of 1; opening the drawer clears it and shows the join line.
5. **Host leaves**: host taps Leave; the longest-present member gets the crown and a "You're now the host" toast; music keeps playing for the others on the same song; new host removes a member; the removed member sees "you were removed" and cannot rejoin with the same code; new host closes the room for everyone.
6. **Reload**: a reload rejoins the same room with the queue intact.
7. **Solo room**: one person can add songs, play, skip, reach the end, and chat.
8. **Host disconnects**: host's tab is closed without leaving; after about 40 s the other person gets the crown ("You're now the host").

### PWA (`tests/pwa/pwa.test.ts`)
Production build (`vite build`, Supabase configuration) served by `vite preview`:

- Manifest: name, short name, start URL, standalone display, background and theme colours.
- Icons: 192 and 512, plus a maskable icon; each file exists and is the declared pixel size.
- Build output: service worker and registration script emitted; index.html links the manifest and icons and registers the worker; the app shell is precached; the manifest is served with a JSON or manifest content type.
- Service worker: registers in Chromium, controls the page after a reload, and the worker code handles `fetch`.

## What could NOT be tested here

These need a real device, a real network, or a real Supabase project. They are on the checklist in DEPLOY.md.

- **Real YouTube playback.** The automated tests use the fake player. The real IFrame player code is written and typechecked but was never run against YouTube. Check: song loads, plays, seeks, ends, and errors skip correctly.
- **Real Supabase.** `schema.sql` has been tested in PGlite, not on a live Supabase project. Expect small differences (for example, Supabase's realtime filters and default privileges). If `schema.sql` fails when you run it, that is the first thing to fix.
- **Anonymous sign-in and realtime against Supabase.** The Supabase adapter (`src/lib/backend/supabase.ts`) is typechecked but has no automated tests. It has not been run.
- **Background play** in Brave on Android with the screen locked, and what iOS does. Automated tests cannot cover this.
- **Sync drift on real networks.** The automated tests check drift on one machine. The 1 s target for remote friends needs two real phones on real networks.
- **The install prompt** on a real phone. The criteria are checked, but Chromium's native installability check (`Page.getInstallabilityError`) was not available in this build, and Lighthouse no longer runs installability audits (DECISIONS.md, decision 60).
- **Media Session controls** on the lock screen. The handlers are wired; they were not exercised on a device.
- **Vercel deployment.** Not done, by design.

## Known issues

1. **The host-disconnect takeover depends on heartbeats.** The longest-present member takes over on their own heartbeat, about 15 s apart, so the real delay is 40 s to about 55 s. The e2e test accepts up to 90 s.
2. **Chat history shows only the last 100 messages.** Older messages are not loaded.
3. **Room creation is not rate-limited** (DECISIONS.md, decision 62).
4. **The seek bar is disabled until the length is known.** Right after a song loads, the seek bar stays disabled for a moment until the player reports its length. Intentional, but it may look inactive for a second on a slow connection.
5. **Presence is per user, not per tab.** One person with two tabs shows as one person.
6. **Lighthouse installability is no longer measured** (DECISIONS.md, decision 60).
7. **Mock-only shortcut in the dev server.** `window.__jam` (the room store) is exposed only in mock builds, so e2e tests can read state. It is not in production builds.
