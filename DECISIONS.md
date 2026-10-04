# Decisions

Every judgment call made while building Jam Room, in the order they came up. Each entry says what was chosen and why, so you can push back on any of them.

## Environment and testing

1. **No Docker, so PGlite.** Docker Desktop's engine was not running on this machine, so the Supabase CLI local stack was not an option. Fallback from the brief: `schema.sql` runs unchanged in PGlite (in-process Postgres) with a small shim (`db/shim.sql`) that provides `auth.users`, `auth.uid()` (reads `request.jwt.claim.sub`), the `anon` and `authenticated` roles, and the `supabase_realtime` publication. The shim is test/mock only and must never run against a real project.
2. **The shim does not grant default privileges.** Supabase grants table privileges to `anon` and `authenticated` by default, which would hide missing grants in the schema. The shim leaves them out, so the schema has to grant what it needs. This is how the missing SELECT grant (decision 8) was found.
3. **Mock backend = a small Node server (`server/mock-server.ts`) wrapping PGlite.** Three browser contexts in Playwright need one shared database, and a browser-side PGlite cannot be shared across contexts. The server runs every call as role `authenticated` with `auth.uid()` set from the `x-user-id` header, so RLS and the SQL membership checks run for real. Realtime is Server-Sent Events, and presence is an open SSE connection. The server is never deployed. Production uses Supabase only.
4. **The mock broadcasts `changed` to every subscriber of the room on each successful RPC** (rooms are taken from `p_room` when present, otherwise all rooms). Clients then reload the snapshot. This is coarser than Postgres changes filtered per table, but simple and correct, and the real adapter does the finer version.
5. **Fake YouTube player for tests (`VITE_PLAYER=fake`).** Deterministic, runs on the real clock while "playing", no network. Special IDs: `SHORTVIDEO1` (8 s, auto-advance tests), `BROKENPLAY1` (fails on load, skip tests), `BROKENADD11` (oEmbed fails, add rejected). The real IFrame player is behind `VITE_PLAYER=youtube` (default) and is not covered by automated tests.
6. **The fake player mirrors its state onto DOM `data-*` attributes** (video, state, duration). Test-visible only.
7. **Time-based rules are tested by moving timestamps, not by waiting.** For example, the 40 s host takeover and the 5 s prev threshold are tested by setting `member_seen` or `anchor_time` into the past. One Playwright test (host disconnects) does wait about 40 s for real.

## Schema fixes found by tests (each has a test that would have caught it)

8. **Members could not read their room.** `schema.sql` set RLS policies and revoked writes but never granted SELECT. Supabase's default privileges hide this in production, but the schema should not depend on that. Added explicit `grant usage` and `grant select` for `rooms`, `room_members`, `songs`, `messages` to `authenticated`. Test: `rls.test.ts` "a member sees their own room".
9. **Any signed-in user could call `_set_current` on any room.** The helper is `security definer` and was granted to `authenticated` by the blanket "all functions" grant, so it bypassed membership. Revoked execute on `_set_current`, `_assert_member`, `_assert_host`, and `gen_code` from `authenticated` (they are only called from inside definer functions). Test: "internal helpers cannot be called directly to bypass membership".
10. **After the last person left, the next joiner was not host.** An idle room kept the departed host's id, so the first person back had no host powers until the 40 s heartbeat takeover. `join_room` now makes the joiner host when the current host is not a member. Test: "when the room is idle (host gone), the first person back becomes host".
11. **`song_ended` with a null song id started playback.** Null equals null in `is distinct from`, so a null report with nothing selected passed the guard and called `next_song`. Added a null guard. Test: "a null song id never starts playback".
12. **`reorder_song` accepted NaN and Infinity.** Those break the ordering of `position` (NaN sorts above everything in Postgres). Positions must be finite. Test: "rejects NaN, Infinity and null positions".
13. **The spec required host transfer to a chosen member, but no RPC existed.** Added `transfer_host(p_room, p_user)`: host only, target must be a current non-kicked member, posts a system line. Tests in `rpc.test.ts`.

## Spec interpretations

14. **Heartbeat takeover is applied by the longest-present online member's own heartbeat.** The SQL only hands over when the calling member is the one who should take over. If the host is silent for 40 s, the longest-joined online member takes over on its next heartbeat, about 15 s later at most. Tests check that other callers do nothing.
15. **`prev_song` / `next_song` set the room to playing.** The brief does not say whether Next keeps a paused room paused. Chose: moving to another song starts it, since "skip" usually means "play the next one". Re-check when you use it.
16. **Unread chat badge counts only other people's chat lines.** System lines ("X joined") and your own messages do not count. The brief says "unread badge when the chat panel is collapsed" and does not say what counts. Seen as a bug in testing when system lines were counted (the badge showed 2 for one message).
17. **Kicked member's row stays with `is_kicked = true`.** Membership checks treat it as not a member; the join path refuses with "You were removed from this room". Keeping the row (instead of deleting it) is what blocks rejoining the same room.
18. **Join by code uses the room code as typed, case-insensitively, with spaces trimmed**, and the client uppercases input as you type. The DB does `upper(trim(code))`.
19. **Duplicate songs are allowed in the queue, with an "already in queue" hint.** Per the brief.
20. **Pasted text with several links is split on spaces, commas, and line breaks.** Junk tokens are reported as "Not a YouTube link: <token>", and the valid ones are still added.
21. **oEmbed failure at add time rejects the video, but a network failure does not.** A non-OK oEmbed response means the video is private or embedding is off, so it is rejected. A network or CORS failure falls back to the title "YouTube video <id>" and adds it anyway, as the brief describes.
22. **Clock offset formula.** The brief's formula `offset = serverMs + rtt/2 - clientNow` is correct only when `clientNow` is the receive time. The code uses the midpoint directly (`offset = serverMs - (sent + received)/2`) and documents the sign (server minus client). Unit tests pin this.
23. **Drift loop tolerance and cool-down follow the architecture doc**: correct above 300 ms, check every 2 s, cool-down 2.5 s. Explicit state changes (seek, pause, skip) correct immediately without the cool-down.
24. **Player is not created until the room screen mounts, and nothing touches it before the first tap.** Browsers block autoplay before a user gesture, so the "Tap to join the music" gate covers everything, including songs that are already playing when you join.
25. **Overlay is a container with an inner button.** The first version nested a `<button>` inside a `<button>`, which is invalid HTML and was caught while writing the tests.
26. **Host leaving with "Leave" is instant; host disconnect waits 40 s.** Both are as the brief says. The e2e tests cover both.
27. **Room closing needs a second tap.** The brief requires confirmation. An in-app "Close room" confirm step is used instead of `window.confirm`, which blocks browser automation and some mobile browsers.
28. **Share uses the native share sheet when available, otherwise copies the link.** When neither works, the code is shown in a toast.
29. **The `?join=` parameter is removed from the address bar after reading**, so a reload does not try to join again. Auto-rejoin after reload uses the stored room code, so reloads still work.
30. **Invite link with a stored name joins at once.** Without a stored name the home form opens with the code filled in, and the friend types a name and taps Join.
31. **An invite link wins over auto-rejoining the last room.** If someone opens a link while they had a previous room, the link is what they get.
32. **Display names are trimmed and capped at 30 characters**, as the DB does. Stored in localStorage (`jam:name`), per the brief.
33. **Service worker: `autoUpdate` with a precache of the app shell.** The brief said "network-first so updates arrive on next open". A precached shell plus `autoUpdate` gives the same result: a new deploy takes effect on the next open after the new worker installs. Google Fonts use stale-while-revalidate.
34. **Queue cap is enforced in the DB (200) and checked in the client before the first oEmbed call**, so a 300-link paste is refused up front rather than failing halfway.
35. **Chat history loads the last 100 messages**, as the architecture doc says.
36. **Presence keys by user id, and one user in two tabs shows as one person** (the presence key is the user id).

## Design and UI

37. **Design plan (frontend-design skill).** Subject: a listening room for friends, with a warm record-shop feel. Palette: warm black `#0E0D0B`, surface `#1B1915`, raised `#262219`, paper text `#F1E9D8`, muted `#8D8473`, and a single vinyl-label gold `#F2C14E` as the one accent. Gold was chosen over the cream and terracotta and acid-green defaults. Type: Instrument Serif for titles and the wordmark, Instrument Sans for UI, one scale, tabular numerals on time. Layout: single column, mobile-first, the square cover is the hero, the queue is a plain list, chat is a collapsed bar that opens a sheet.
38. **Design review.** The first pass had an eyebrow label above each heading and middle-dot meta strings. Both were removed because they are the generic tells the skill warns about. The queue keeps no position numbers: the list order and the playing row's gold accent carry it.
39. **No icon library.** Small inline SVGs keep the bundle small and avoid another dependency.
40. **Mobile-first, with the room in a 560 px column on wider screens**, so it still reads as a phone app on a laptop.
41. **Reduced motion is respected** (animations and transitions turned off under `prefers-reduced-motion`).
42. **Dark only.** The brief asked for dark.

## Stack and dependency choices

43. **`@vitejs/plugin-react` pinned to v5.** v6 needs a newer Vite than 7.x. Vite 7 is kept because `vite-plugin-pwa` supports it.
44. **`vitest` 3.x instead of 4.x**, so the Vite 7 peer range stays satisfied.
45. **`npm install --legacy-peer-deps`** for some dev packages whose peer ranges disagree with each other. Nothing at runtime depends on it.
46. **Zustand for client state**, with selectors that return stable references (arrays and maps are derived with `useMemo`, not inside selectors, to avoid infinite update loops; this was a real bug in the first pass).
47. **`@dnd-kit` for drag reorder** with pointer distance 6 px and touch delay 180 ms, so taps still play a song.
48. **Local storage is wrapped in try/catch.** Private windows and blocked storage must not break the app.

## Docs and repo

49. **`context.md`, `architecture.md`, and `schema.sql` were updated** where the build changed them: the `transfer_host` RPC, the grants, the internal-helper lockdown, and the idle host rule. See the diff for exact changes.
50. **Git repo initialised on `main`.** Commits are per milestone. The user's own files (`context.md`, `architecture.md`, `schema.sql`, `files.zip`) were committed in the first commit with the schema fixes.
51. **`.env.example` only; no real keys anywhere.** `.env.mock` contains only the two mode flags (`VITE_BACKEND=mock`, `VITE_PLAYER=fake`), no secrets.
52. **No deployment, no Vercel, no real Supabase project.** Per the brief.

## Found and fixed during the end-to-end run

53. **Tap-to-join gate never passed in tests and a nested button was invalid.** The overlay was a `<button>` containing a `<button>`. It is now a container with one inner button. The fake player never loaded because the test tapped before the overlay rendered; the helper now waits for it.
54. **Seek bar clamped to 0:01 for the first two seconds.** The duration was only read in the 2 s drift loop, so the range's `max` stayed at 1. Duration is now read straight after `load`, and the bar is disabled while the length is unknown.
55. **Seek bar step is 0.1 s, not 0.5 s.** At 0.5 s the browser rounds the displayed value, which made the "paused" check flaky by up to a second. Keyboard seek test now uses 100 steps.
56. **Store selectors returned new arrays and maps.** That caused an infinite render loop (React "Maximum update depth exceeded"). Fixed by selecting stable arrays and deriving with `useMemo`.
57. **Unread badge counted "joined" system lines.** Now counts only other people's chat messages (decision 16).
58. **Host-leave test hung for two minutes.** Cause: the People sheet stayed open after "Remove" and its scrim covered the `.people` button, so the test's click waited forever (Playwright's default action timeout is unlimited). Fixed in the test, and `actionTimeout: 15000` added to the Playwright config so a stall now fails fast.
59. **Chat unread badge and an invite link** are covered by the e2e suite; no separate code change.

## Installability check

60. **Lighthouse cannot check installability any more.** Lighthouse 12+ removed the `pwa` category and its installability audits (`installable-manifest`, `service-worker`, `maskable-icon`, etc.). The Chromium build used by Playwright also lacks the `Page.getInstallabilityError` CDP call. So installability is checked criterion by criterion in `tests/pwa/pwa.test.ts`: valid manifest, icons at the declared sizes, the service worker registers and controls the page, the worker handles fetch, and the manifest is linked and served with the right type. Lighthouse and chrome-launcher were removed from the dependencies. This is a real gap: confirm the install prompt on a phone (DEPLOY.md section 7).
61. **Production PWA build uses the Supabase config** (no mock backend), since that is the deploy configuration. The mock build is only for dev and e2e.

## Known gaps accepted for v1

62. **Room creation is not rate-limited.** Any anonymous user can create rooms. Acceptable for a friends-only app; see DEPLOY.md section 9.
63. **The mock server trusts the `x-user-id` header.** It is test-only, never deployed, and runs only on 127.0.0.1.

## Round 2: real playback, new home and room screens

64. **Real YouTube mode for local use.** The local dev server used the fake player, so there was no sound and every title was a placeholder. New mode `mock-real` (`.env.mock-real`: `VITE_BACKEND=mock`, `VITE_PLAYER=youtube`), started with `npm run dev:local`. Verified in headless Chromium: the embedded video is playing (not paused, not muted, time advancing) and the real oEmbed title shows. Audible output itself was not heard (no audio device in the test).
65. **Create a room shows the code first.** Home is: name at top; "Create a room" and "Join a room" pinned to the bottom. Create makes the room and shows its code and invite link with an "Open room" button. Entering is a separate step (`openPendingRoom`); "Back" leaves the fresh room so it goes idle.
66. **Member avatars moved to a stack on the header's right side**, with online dots and a crown on the host, instead of a row above the player. Online members sort first; more than four collapse into "+N". A count appears from 440 px wide.
67. **Seek bar shows 0 until the length is known.** Previously the thumb sat at the position while the length showed `--:--`.
68. **"You left the room" is an info toast, not an error.**
69. **Invite link bug (fixed).** The `?join=` code was kept for the whole page session, so after leaving a room that came from a link the home screen stayed in join mode. Now stored once per page load and cleared on entering a room.
70. **StrictMode double-mount bug (fixed).** React mounts twice in development. The second mount read `?join=` again after the first had removed it, and overwrote the invite with null, so a friend opening a share link never got the join form. `boot` now runs once per page load, and the URL is read once at module load.
71. **Flaky PWA check made deterministic.** The service-worker test raced installation. It now awaits `navigator.serviceWorker.ready` and checks that an active worker exists.

## Round 3: sync fix and the DESIGN.md rebuild

72. **Late joiners did not land on the room's moment when clocks differed.** Reproduced with the real YouTube player: a joiner whose clock was 15 s off started at the wrong position and took about 4 s to converge. Cause: entering a room did not wait for the clock-offset sync, so the Join gate could be tapped with offset 0. Fixed: entering a room awaits the offset sync first, and drift is checked the moment the player reports it is playing. Verified: joiner clock +15 s, -15 s and exact all converge within about 3 s and stay within 0.1 s.
73. **Mock backend crashed after many test runs** (WebAssembly heap in PGlite). Each reset created a new database instance. Reset now truncates in place.
74. **Avatars are stored with members** (`room_members.avatar`, format-checked, updated on rejoin, null keeps the stored value). Tests: storage, junk rejected, rejoin behaviour.
75. **Design built from DESIGN.md**: walnut and paper tokens exactly as specified; Fraunces, DM Sans, Special Elite and IBM Plex Mono self-hosted through npm (no Google Fonts request); onboarding with 12 icons and 8 ring colours; home with two large cards; ticket with the code and link; six-box code entry; room with a stage and a rail (desktop) or tabs (phone); three skins (turntable with a rAF spin and tonearm, cassette with reels, iPod with a working click wheel); always-mounted video dock.
76. **Judgment calls in the design build**: the turntable fader and the cassette fader are the volume control for those skins (iPod gets the shared row); the tonearm rests at 90 degrees and lowers onto the outer groove at 153.8 degrees plus progress; the paper-500 text colour is #948874 (not #8f826c) to clear 4.5:1 on the walnut surfaces; "Install the app" is not shown (no install prompt wiring yet); the QR code is not included.
77. **Not built yet from DESIGN.md**: the power-on moment (7.5), the QR code (6.3), the install link (6.2), and the axe and screenshot assertions (section 16). The spacing and visual polish are the next pass, as requested.
