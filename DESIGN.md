# Jam Room: Frontend Design Spec

Read this together with `context.md`, `architecture.md` and `schema.sql`. **This file replaces the current look and layout.** All functionality and sync logic stays as it is; this is a presentation rewrite plus onboarding with avatars and selectable player skins.

Use the `frontend-design` skill. Follow this spec where it is specific; use judgment where it is silent.

---

## 1. What is wrong with the current UI (from screenshots)

1. The song title is set in a huge condensed serif and wraps to about ten lines, pushing the controls off screen. Titles must clamp to 2 lines.
2. The room is a narrow column inside a wide desktop window, and the page scrolls. The artwork is cropped at the bottom and collides with the "Chat" bar.
3. Chat is a collapsed bar overlapping the queue. It should be a visible side panel with messages.
4. The home screen stretches the name field full width, leaves a large empty gap, and pushes "Create a room" and "Join a room" to the very bottom.
5. The wordmark puts a single word in italic gold. That is a template tell; use one consistent treatment.
6. Nothing feels like music. The product has no physical character yet.

## 2. Direction: "the listening room"

A late-70s hi-fi corner at night. The app chrome is dark walnut. The player is a physical object sitting on the table: a turntable, a cassette, or an iPod, chosen by the user. A dial-lamp amber glows where something is active.

The one memorable thing is **the player object itself** (spinning, with real mechanics). Everything else is quiet, disciplined, and flat so the device stands out. Skeuomorphic detail lives only inside the three devices, never in buttons, lists, or inputs.

### Design review (what was rejected and why)
- Cream background + high-contrast serif + terracotta: this is the common generated look, so it is rejected. The chrome is walnut brown with chrome and amber instead.
- Near-black + one acid accent: rejected. Surfaces are warm browns with three working colors (amber for activity, green for online, red for record/destructive).
- ALL-CAPS tracked eyebrow labels, middle-dot meta strings, "→" on buttons, and decorative numbering: not used. Labels are sentence case.
- Entrance animations on every section: not used. One orchestrated moment only (section 7.5).
- Monospace for small labels everywhere: not used. Mono appears only for the room code, time readouts, and the typewriter text on the cassette.

---

## 3. Design tokens

Put all of these in `src/styles/tokens.css` as CSS variables. No hard-coded colors, sizes, or durations in components.

### 3.1 Color

| Token | Hex | Use |
|---|---|---|
| `--walnut-950` | `#17100c` | Page background behind everything |
| `--walnut-900` | `#201610` | App surfaces (header, rail) |
| `--walnut-800` | `#2c1e15` | Raised surfaces, inputs, list rows |
| `--walnut-700` | `#3d2a1d` | Borders, dividers, hover |
| `--walnut-500` | `#6f523c` | Disabled, faint icons |
| `--paper-100` | `#f2e8d5` | Primary text on dark |
| `--paper-300` | `#c9bba1` | Secondary text |
| `--paper-500` | `#8f826c` | Tertiary text, placeholders (check contrast, min 4.5:1 for body text) |
| `--chrome-100` | `#e9e7e2` | Device faceplate light (iPod, turntable plinth) |
| `--chrome-300` | `#bdb9b0` | Device faceplate mid |
| `--chrome-600` | `#6d6a63` | Device faceplate shadow |
| `--shell-800` | `#35332f` | Cassette shell |
| `--lamp-400` | `#ffb547` | Dial-lamp amber: active, current track, primary button |
| `--lamp-600` | `#d98a14` | Amber pressed/hover |
| `--lamp-glow` | `rgba(255,181,71,.35)` | Glows and focus halo |
| `--vu-400` | `#7ed39a` | Online dot, success |
| `--rec-500` | `#d6453d` | Record light, destructive actions, cassette accents |
| `--tape-teal` | `#2f8f7c` | Cassette label stripe only |
| `--tape-brown` | `#2b1b12` | Cassette tape pack |

Text on `--lamp-400` buttons is `--walnut-950`.

### 3.2 Typography

Self-host fonts through npm (no Google Fonts request, so the PWA works offline). Verify each package name on npm before installing.

| Role | Family | Package | Use |
|---|---|---|---|
| Display | Fraunces (variable, use `SOFT` 100 and `WONK` 0 for a rounded 70s feel, weight 500 to 650) | `@fontsource-variable/fraunces` | Wordmark, screen headings, song title on the stage |
| Body / UI | DM Sans (variable) | `@fontsource-variable/dm-sans` | Everything else |
| Typewriter | Special Elite | `@fontsource/special-elite` | Cassette label text only |
| Readout | IBM Plex Mono | `@fontsource/ibm-plex-mono` (400, 500) | Room code, time readouts, iPod elapsed time |

Scale (fluid with `clamp`):

| Token | Size | Line height | Use |
|---|---|---|---|
| `--fs-display` | `clamp(2rem, 1.2rem + 3vw, 3.5rem)` | 1.05 | Screen headings on onboarding and home |
| `--fs-title` | `clamp(1.25rem, 1rem + 1vw, 1.75rem)` | 1.2 | Song title on stage (**max 2 lines**, `line-clamp`) |
| `--fs-h2` | `1.25rem` | 1.3 | Panel headings |
| `--fs-body` | `0.9375rem` (15px) | 1.5 | Body, chat, queue rows |
| `--fs-small` | `0.8125rem` (13px) | 1.4 | Secondary info |
| `--fs-micro` | `0.75rem` (12px) | 1.3 | Timestamps, badges |

Rules: sentence case everywhere. Line length under 70 characters in running text. Titles use `text-wrap: balance`. Long titles in the queue and mini-player truncate to one line with an ellipsis; the full title is available as a `title` attribute and on the stage.

### 3.3 Spacing, radius, elevation

- Spacing is a 4 px base: `4, 8, 12, 16, 24, 32, 48, 64`.
- Radius is different per element role (not one value everywhere): `--r-chip 8px`, `--r-input 12px`, `--r-card 18px`, `--r-sheet 28px`, `--r-pill 999px`. Devices have their own radii (section 7).
- Elevation is warm, never grey: `--shadow-1: 0 1px 0 rgba(255,225,170,.06) inset, 0 6px 16px rgba(10,5,2,.45)`; `--shadow-2: 0 1px 0 rgba(255,225,170,.08) inset, 0 18px 40px rgba(10,5,2,.6)`. Devices on the stage also cast a floor shadow (an ellipse under them).
- Minimum touch target 44 x 44 px.

### 3.4 Motion

- Durations: `--t-fast 120ms`, `--t-base 220ms`, `--t-slow 420ms`.
- Easing: `--ease-out: cubic-bezier(.2,.8,.2,1)`; `--ease-mech: cubic-bezier(.3,.7,.4,1)` for mechanical parts.
- Interaction feedback only (press, expand, switch skin). No scroll-triggered or load-triggered effects except the single power-on moment (section 7.5).
- `prefers-reduced-motion: reduce`: no spinning, no tonearm sweep, no wobble. Show a static device with a progress ring. Skin switch becomes an instant swap.

### 3.5 Texture

- A very subtle film-grain overlay (SVG `feTurbulence` data URI, 4 to 6 percent opacity, `mix-blend-mode: overlay`) on the page background and on device surfaces. It must not repaint on scroll (use `position: fixed` with `pointer-events: none`).
- Walnut surfaces can carry a faint vertical grain made from two layered `repeating-linear-gradient`s at 3 percent contrast. Keep it barely visible.

---

## 4. Layout system

The room is **a fixed-height app shell**: `height: 100dvh`, `overflow: hidden`. The page never scrolls. Only the queue list and the chat list scroll inside their panels.

| Breakpoint | Layout |
|---|---|
| under 640 px (phone) | Single column. Bottom tab bar: Player, Queue, Chat. A mini-player sits above the tab bar when Queue or Chat is open. |
| 640 to 1023 px (tablet) | Single column like phone, with the stage up to 560 px wide and centered. |
| 1024 px and up (desktop) | Two zones: **Stage** (flexible, centered content) and **Rail** (fixed 380 px, right). Rail stacks Queue on top (45 percent) and Chat below (55 percent). |
| 1600 px and up | Rail grows to 420 px. The stage content stays capped so devices do not grow past 560 px. |

Forms (onboarding, home, join) are a centered card, max 440 px wide, vertically centered in the viewport. They never stretch to full width on desktop.

Safe areas: pad with `env(safe-area-inset-*)`. Use `viewport-fit=cover`.

---

## 5. Flow

```
First visit:   Onboarding (name + avatar) -> Home (create or join)
Return visit:  Home (profile chip shows name + avatar, tap to edit)
Create:        Home -> Room ready (code + link) -> Enter room
Join by code:  Home -> Join (6-box code entry) -> Room
Join by link:  ?join=CODE -> (Onboarding if no profile) -> Room, joined automatically
Reload:        Rejoins last room automatically (existing behavior)
```

Profile (name, avatar) and skin choice are stored in `localStorage`. A profile that exists skips onboarding.

---

## 6. Screens

### 6.1 Onboarding: "Who's listening?"

Centered card on the walnut background, with the wordmark above it.

```
              [ Jam Room wordmark ]

        ┌──────────────────────────────────┐
        │  Who's listening?                │
        │                                  │
        │  Your name                       │
        │  [_____________________________] │
        │                                  │
        │  Pick a face                     │
        │        ( large preview avatar )  │
        │  [o][o][o][o][o][o]              │
        │  [o][o][o][o][o][o]   12 icons   │
        │  Ring color:  ● ● ● ● ● ● ● ●    │
        │                      [Surprise me]│
        │                                  │
        │  [        Continue (amber)     ] │
        └──────────────────────────────────┘
```

- Name: 1 to 30 characters, required, autofocus, `autocomplete="nickname"`. The Continue button is disabled until the name is valid. Enter submits.
- Avatar picker: 12 icon badges in a 6 x 2 grid (44 px each, 8 px gap), 8 ring colors, a large 96 px live preview, and a "Surprise me" button that randomizes both. Selected icon gets an amber ring and a small check.
- Avatar icons (flat, 2 to 3 color vintage-sticker style, drawn as inline SVG, no external image files): `vinyl`, `cassette`, `headphones`, `boombox`, `microphone`, `guitar`, `piano-keys`, `radio`, `jukebox`, `speaker`, `tape-reel`, `ipod`.
- Ring colors (ids): `amber #ffb547`, `red #d6453d`, `teal #2f8f7c`, `sky #5aa6d6`, `plum #9b6bb0`, `rose #e07a9a`, `lime #a6c94a`, `chrome #bdb9b0`.
- Avatar value is stored as a string `"<icon>:<color>"`, for example `"cassette:teal"`. If an avatar is missing, show the name's first letter on a chrome circle.
- Default avatar on first open: random.

### 6.2 Home

Same centered card. Top: profile chip (avatar 32 px + name + "Edit") aligned left, wordmark above.

```
        ┌──────────────────────────────────┐
        │ (av) Tej                  Edit   │
        │                                  │
        │  Listen together.                │
        │  Same song, same second, from    │
        │  wherever your friends are.      │
        │                                  │
        │  ┌────────────────────────────┐  │
        │  │  Start a room              │  │  primary card, amber
        │  │  Get a code to share       │  │
        │  └────────────────────────────┘  │
        │  ┌────────────────────────────┐  │
        │  │  Join with a code          │  │  secondary card, outlined
        │  │  Got a code or link?       │  │
        │  └────────────────────────────┘  │
        │            Install the app       │  only if installable
        └──────────────────────────────────┘
```

Both are large tappable cards (min height 88 px), side by side on desktop if width allows, stacked on phone. Heading uses the display face. The two card actions stay close to the headline; the page has no big empty gap.

### 6.3 Room ready (after "Start a room")

The room is created, then this screen appears before entering. It looks like a ticket stub with a perforated edge (CSS mask).

```
        ┌──────────────────────────────────┐
        │  Your room is ready              │
        │  Send this to your friends.      │
        │                                  │
        │   ┌──────────────────────────┐   │
        │   │   K 7 P 2 Q X            │   │  mono, 48px, letter-spaced
        │   │ - - - - - - - - - - - -  │   │  perforation
        │   │  https://app/?join=K7P2QX│   │
        │   └──────────────────────────┘   │
        │  [Copy code] [Copy link] [Share] │
        │             [Show QR code]       │
        │                                  │
        │  [        Enter room (amber)   ] │
        └──────────────────────────────────┘
```

- "Share" uses `navigator.share` when available, otherwise it is hidden.
- "Copy code" and "Copy link" change their label to "Copied" for 1.5 s.
- QR code is optional and collapsed by default (`qrcode` library, rendered to a canvas, paper-colored on walnut).
- "Enter room" joins and starts the power-on moment (7.5).

### 6.4 Join with a code

Six separate character boxes (52 x 64 px, mono, uppercase). Auto-advance on type, backspace moves back, paste fills all six. Allowed characters follow the code alphabet (no 0, O, 1, I, L). "Join room" is disabled until all six are filled. Errors appear under the boxes in `--rec-500`: "That code doesn't match a room. Check the six characters and try again." Other server messages are shown as returned ("Room is full", "You were removed from this room").

### 6.5 Room (desktop)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Jam Room        [ K7P2QX  ⧉ ]            (av)(av)(av) +2   [Invite] [Leave]│  header 64px
├───────────────────────────────────────────────┬────────────────────────────┤
│                                               │ Up next                 12 │
│            Skin:  [Turntable|Cassette|iPod]   │ ┌────────────────────────┐ │
│                                               │ │ Paste a YouTube link [+]│ │
│             ┌───────────────────┐             │ ├────────────────────────┤ │
│             │                   │             │ │ ▮▮▮ 1 [img] Title      │ │ current, amber bar
│             │   the player      │             │ │     2 [img] Title      │ │
│             │   (skin)          │             │ │     3 [img] Title      │ │
│             │                   │             │ │     ... (scrolls)      │ │
│             └───────────────────┘             │ └────────────────────────┘ │
│                                               ├────────────────────────────┤
│        Song title, two lines max              │ Chat                       │
│        Added by (av) Ravi                     │  (av) Ravi          9:41   │
│   ━━━━━━━━━━━●━━━━━━━━━━━━━━  1:53 / 4:21     │  Play the next one         │
│        [video: Show]       volume ▁▃▅▇        │   — Tej joined —           │
│                                               │ [ Message...          ] ➤ │
└───────────────────────────────────────────────┴────────────────────────────┘
```

### 6.6 Room (phone)

```
┌────────────────────────┐
│ Jam Room  K7P2QX (av)+2│  header 56px (code chip, member stack, menu)
├────────────────────────┤
│ [Turntable|Cassette|iPod]│ skin switcher, compact
│                        │
│    ┌──────────────┐    │
│    │  the player  │    │  size = min(88vw, 46dvh)
│    └──────────────┘    │
│  Song title (2 lines)  │
│  Added by (av) Ravi    │
│  ━━━━━●━━━━━ 1:53/4:21 │
├────────────────────────┤
│ [ Player ][ Queue ][ Chat•3 ] │ tab bar 56px, unread badge on Chat
└────────────────────────┘
```

Queue and Chat open as full-height panels above the tab bar, with a 56 px mini-player (thumbnail, 1-line title, play/pause) pinned between the panel and the tab bar.

---

## 7. Player skins

The user picks a skin with a segmented control (icons plus labels): Turntable, Cassette, iPod. The choice is **per user**, stored in `localStorage` (`jam_skin`), default Turntable. Skins only change presentation; every skin calls the same actions (play, pause, next, previous, seek, volume) and reads the same state (current song, playing, position, duration).

### 7.0 Shared rules
- Each skin is a self-contained component with the props: `song`, `isPlaying`, `positionMs`, `durationMs`, `volume`, `onPlayPause`, `onNext`, `onPrev`, `onVolume`, `size`.
- Skins are drawn with **inline SVG and CSS** (no raster images, no three.js; see section 12 for why). Devices scale to fit using the `size` prop (px), computed from the container (`ResizeObserver`).
- Under every skin (all breakpoints): song title (2 lines max), "Added by" with the avatar, the shared seek bar (4 px track, 16 px amber thumb, elapsed and total time in mono), and the volume control. The iPod's on-screen progress bar is display-only.
- Swapping skins: 250 ms crossfade with a slight scale (0.98 to 1). Never reload the YouTube player when the skin changes.
- All device parts are decorative for screen readers (`aria-hidden`); the real controls are the buttons, each with an `aria-label` ("Play", "Pause", "Next song", "Previous song").
- Artwork: the song's thumbnail, treated with `filter: sepia(.35) saturate(.9) contrast(1.05)` so it sits inside the vintage look.

### 7.1 Turntable (reference: top-down turntable photo)

Design: brushed-aluminum plinth viewed from above, black vinyl on a platter, a tonearm that moves across the record as the song plays.

- SVG viewBox `0 0 600 460`. Plinth: rounded rect, radius 24, fill `--chrome-300` with a horizontal brushed-metal gradient (`--chrome-100` to `--chrome-300` to `--chrome-100`) and a 1 px lighter top edge.
- Platter center `(230, 230)`, outer ring radius 190 (`--chrome-600` ring), vinyl radius 176, label radius 62, spindle radius 5.
- Vinyl grooves: `repeating-radial-gradient` (circle, `#0c0c0c` 0 2px, `#171717` 2px 3px) with 3 to 4 slightly wider "track gap" rings. Add a **stationary sheen layer** on top that does not rotate (light stays fixed while the disc turns): a `conic-gradient` with two soft highlights at about 15 percent opacity.
- Center label: the circular-cropped thumbnail inside a thin cream ring.
- **Rotation:** 33⅓ rpm = 200 degrees per second. Drive the angle with a `useSpin(isPlaying)` hook using `requestAnimationFrame` and an angular velocity that eases up over about 0.8 s on play and down over about 1.6 s on pause (inertia). Write the angle to a CSS variable, not React state, to avoid re-rendering.
- **Tonearm:** pivot at `(505, 95)`. Rest angle 0 degrees (parked). When playing, it swings to the outer groove at +24 degrees and then drifts linearly to +40 degrees at the end of the song (`angle = 24 + 16 * progress`). On pause it lifts and returns to rest in 600 ms with `--ease-mech`. A small cartridge shape at the end, with a slight shadow on the record.
- **Start/stop button** (bottom-left, 56 px chrome button with a green LED ring when playing): play/pause.
- **Previous and next:** two smaller chrome buttons beside start/stop.
- **Pitch fader** (right side, vertical slider, 120 px): this is the **volume control** for this skin. Draw as a recessed slot with a chrome cap. Keyboard accessible (it is a real `input[type=range]` styled vertically).
- **Power knob** (top-left): decorative, with a small lamp that lights amber while the room has a song loaded.
- Floor shadow: ellipse under the plinth, 40 percent opacity, blurred 24 px.
- Size on stage: `clamp(280px, min(56vw, 56vh), 520px)` wide (the plinth is 600:460).

### 7.2 Cassette (reference: Sony UX-S cassette)

Design: a charcoal cassette shell with a paper label, two reels visible through the window, tape pack that moves from one reel to the other as the song plays.

- SVG viewBox `0 0 400 253` (real cassette ratio 1.58:1). Shell: rounded rect radius 14, fill `--shell-800` with a subtle diagonal grain and a 1 px inner highlight. Four corner screws (r 5) and a small "A" side mark bottom-left.
- **Label** (top 52 percent): paper `#e8dcc3`, radius 6. A teal stripe (`--tape-teal`) across the middle, a thin red stripe (`--rec-500`) under it. Text in Special Elite: the song title (2 lines, clamp, 15 px), "Side A" small, and the song length as a large italic Fraunces number at right (`4:21`).
- The thumbnail sits in a small 56 x 56 square at the left of the label with the vintage filter.
- **Window:** rounded slot in the lower label showing two reels. Each reel: hub (r 22) with 6 teeth, spinning. Tape pack circle behind each hub in `--tape-brown`: left reel radius `44 - 22 * progress`, right reel radius `22 + 22 * progress`.
- **Rotation:** both hubs rotate at about 300 degrees per second while playing. The reel with the smaller tape radius turns slightly faster (scale speed by `44 / radius`, capped). Stop with a short ease (400 ms) on pause.
- Bottom trapezoid with two circular holes (r 11) with red rims.
- **Transport keys** below the cassette: three chunky mechanical keys, 72 x 56 px, labeled with icons (previous, play/pause, next). Style as deck keys: top face in `--chrome-300`, side depth 6 px, `translateY(4px)` and reduced depth when pressed (`--ease-mech`, 90 ms). The play key stays depressed (and amber-lit) while playing.
- **Volume:** a horizontal slider styled as a small recessed fader under the keys.
- Size on stage: `clamp(300px, min(64vw, 70vh), 560px)` wide.

### 7.3 iPod (classic click-wheel)

Design: a silver iPod with a screen and a click wheel. The wheel really works.

- Body ratio about 0.6 (width 300, height 500 at base scale). Radius 34. Brushed-silver gradient (`#f3f2ef`, `#cfccc6`, `#e6e4df` at 160 degrees), 1 px white inner highlight, a thin darker bottom edge.
- **Screen:** 248 x 186 at base scale, inset 16 px from the top, black 3 px bezel, rounded 6. Interface is the classic light UI: gray gradient header bar (small play/pause icon, "Now Playing" or "Up next" title, a decorative battery icon), white body.
- **Now Playing screen:** title (2 lines), "Added by <name>", progress bar (blue `#3c8ed8` fill), elapsed time left and remaining time right (IBM Plex Mono 11 px), a tiny speaker icon with a volume bar that appears for 1.5 s whenever volume changes.
- **Up next screen:** the queue as a list (22 px rows, current song marked with a small play icon, highlighted row has a blue gradient and white text). The thumbnail is shown at the left of Now Playing (62 px square) when width allows.
- **Click wheel:** 190 px circle, `#f7f7f5` with a soft inner shadow, drawn with four printed labels: "Menu" (top), previous (left), next (right), play/pause (bottom), in `#9a9a96`. Center button: 72 px silver circle.
  - Tap top: toggle between Now Playing and Up next.
  - Tap left / right: previous / next (hold is not needed).
  - Tap bottom or center on Now Playing: play/pause.
  - **Circular drag** (pointer events, track the angle around the wheel center): on Now Playing, clockwise raises volume, counter-clockwise lowers it (1 step per 12 degrees). On Up next, it moves the highlight (1 row per 20 degrees). Center button on Up next plays the highlighted song.
  - Call `navigator.vibrate?.(4)` on each step. No click sounds (they would fight the music).
- Size on stage: `clamp(240px, min(50vw, 56vh), 360px)` wide.

### 7.4 Hidden YouTube player (important)

The YouTube iframe must stay mounted and rendered in every skin. Do not use `display: none`.

- Render it in a fixed container at `right: 12px; bottom: 12px; width: 240px; height: 135px; z-index: 5`.
- Hidden state (default): `opacity: 0.01; pointer-events: none;` and covered by nothing else; the page above it paints over it.
- A "Show video" toggle on the stage fades it to full opacity, adds a rounded border and shadow, and enables pointer events. A close button hides it again.
- On phones the toggle opens it above the tab bar, still 240 x 135.

### 7.5 The one orchestrated moment: power-on

When the user enters a room, play a single 900 ms sequence on the active skin: it fades in, then the platter spins up and the tonearm lowers (turntable), the reels start (cassette), or the screen wakes (iPod). Skip it if reduced motion is on and skip it on reloads that rejoin a room (only when entering from Home or Room ready).

---

## 8. Queue ("Up next")

- Panel header: "Up next" on the left and `12 songs` on the right.
- Add bar pinned at the top of the panel: a single input ("Paste a YouTube link") and an amber "Add" button. Pasting several links adds them one by one. While fetching the title, show a skeleton row. Errors appear inline under the input: "That doesn't look like a YouTube link" or "That video can't be played here (private or embedding disabled)".
- Rows: 60 px tall. Left to right: drag handle, thumbnail 44 x 44 (vintage filter, radius 8), title (1 line, ellipsis) with "Added by <name>" below in `--fs-small`, remove button (visible on hover and always on touch).
- The current song: amber bar on the left (3 px), amber title, and a small animated three-bar equalizer in place of the index when playing (static when paused; static in reduced motion).
- Tapping a row plays that song. Dragging reorders (existing logic). During drag the row lifts (`--shadow-2`) and a 2 px amber insertion line shows the drop spot.
- Empty state: "Nothing queued yet. Paste a YouTube link to start the first track."
- The list scrolls inside the panel; the current song scrolls into view when the song changes (only if the user is not manually scrolling).

## 9. Chat

- Always visible in the desktop rail (below the queue), a tab on phone.
- Message layout: avatar 28 px, name (`--fs-small`, `--paper-300`), time (`--fs-micro`, `--paper-500`), then the text. Consecutive messages from the same person within 2 minutes group under one header.
- Own messages are right-aligned with a `--walnut-700` bubble tinted by a 10 percent amber wash; others are left-aligned on `--walnut-800`. Bubble radius 14 with a 4 px corner toward the avatar.
- System lines (joined, left, host changed, couldn't play): centered, `--fs-small`, `--paper-500`, italic, for example "Tej joined", with no avatar.
- When the current song changes, add a quiet system line: "Now playing <title>" (truncate to 60 characters). This is client-side only; do not store it.
- Input: single line, max 500 characters, Enter sends, Shift+Enter is not needed. Send button is a 44 px amber icon button, disabled when empty. Show a character counter only above 450.
- Autoscroll to the newest message only if the user is already at the bottom. If not, show a "New messages" pill that jumps to the bottom.
- Unread: on phone, an amber badge on the Chat tab. On desktop no badge is needed.
- Empty state: "Say something. Everyone in the room sees it."

## 10. Members and avatars

- Header member stack: up to 4 overlapping avatars (-8 px overlap, 2 px walnut border), then a `+N` chip. A green dot on an avatar means online; offline avatars are at 50 percent opacity. The host has a small amber crown badge.
- Tapping the stack opens a member panel (popover on desktop, bottom sheet on phone): full list with avatar, name, "Host" label, online status, and for the host a "Remove" button per member (confirm first).
- Avatar component sizes: 24, 28, 32, 44, 96. Always render the `"<icon>:<color>"` string; fall back to the first letter on a chrome circle.
- "Invite" button in the header opens a small sheet with the code, "Copy link", and "Share".
- Header buttons: "Invite" (outlined) and "Leave" (text). When the user is host, "Close room" lives in the member panel footer (destructive, confirm first).

## 11. Components, states and copy

- **Buttons:** primary = amber fill, dark text, radius `--r-pill`, 48 px tall. Secondary = 1 px `--walnut-700` outline, paper text. Destructive = `--rec-500` text with a tinted hover. Pressed: `translateY(1px)` and darker fill. Focus-visible: 2 px `--lamp-400` outline with `--lamp-glow` halo.
- **Inputs:** `--walnut-800` fill, 1 px `--walnut-700` border, radius `--r-input`, 48 px tall, amber border and glow on focus.
- **Toasts:** bottom center on phone, top center on desktop, paper background with dark text, 3 s. Use the same verb as the action ("Link copied", "Song added", "You left the room").
- **Loading:** skeleton rows in the queue and chat. When joining a room, show the device in a dim "off" state with the label "Tuning in..." until the first state arrives.
- **Overlay "Tap to join the music":** a centered card over a dimmed stage with the large amber "Join the music" button and the line "Your browser needs one tap before it can play sound." The room's skin is visible behind it.
- **Errors:** say what happened and what to do. No apologies. Example: "Connection lost. Reconnecting..." with a spinner chip in the header; it clears when the room state arrives.
- **Offline PWA:** if the app shell loads without a network, show a card: "You're offline. Reconnect to join a room."
- Wordmark: "Jam Room" in Fraunces 600, one weight and one color (`--paper-100`), with a small vinyl-notch mark (a 22 px circle with a center hole and one highlight) to its left. No italic or colored word.

## 12. Libraries and files to add

| Need | Package | Notes |
|---|---|---|
| Fonts | `@fontsource-variable/fraunces`, `@fontsource-variable/dm-sans`, `@fontsource/special-elite`, `@fontsource/ibm-plex-mono` | Import only the weights used. Included in the PWA precache. |
| Icons | `lucide-react` | Stroke 1.75. Device icons and avatars are custom SVG. |
| Animation | `motion` (the Framer Motion package) | Skin crossfade, bottom sheets, popovers, tonearm and reel easing where CSS is awkward. Use CSS for the continuous spinning. |
| QR code | `qrcode` | Optional, lazy-loaded only when "Show QR code" is opened. |
| Class names | `clsx` | Small helper. |
| Drag and drop | existing `@dnd-kit/*` | Unchanged. |

**Not recommended: three.js.** It adds hundreds of KB, drains phone batteries, and complicates the PWA. The conic-gradient sheen, layered shadows, and SVG mechanics reach the same premium look for these three devices at a fraction of the cost. If a true 3D tilt is wanted later, use a CSS `perspective` card that tilts on pointer move.

Keep the existing styling approach (do not migrate frameworks). All tokens go in `src/styles/tokens.css`; base styles in `src/styles/global.css`.

New files (adjust to the existing structure):

```
src/styles/tokens.css            # section 3
src/styles/global.css            # reset, grain overlay, focus styles
src/components/brand/Wordmark.tsx
src/components/avatar/Avatar.tsx
src/components/avatar/AvatarPicker.tsx
src/components/avatar/icons.tsx   # 12 SVG avatar icons
src/screens/Onboarding.tsx
src/screens/Home.tsx
src/screens/RoomReady.tsx
src/screens/JoinCode.tsx
src/screens/Room.tsx              # shell, breakpoints
src/components/stage/Stage.tsx
src/components/stage/SkinSwitcher.tsx
src/components/stage/SeekBar.tsx
src/components/stage/VolumeControl.tsx
src/components/stage/VideoDock.tsx   # the always-mounted YouTube container
src/components/skins/Turntable.tsx
src/components/skins/Cassette.tsx
src/components/skins/IPod.tsx
src/hooks/useSpin.ts              # rAF rotation with inertia
src/hooks/useSkin.ts              # localStorage-backed skin choice
src/hooks/useVolume.ts            # localStorage-backed volume, calls player.setVolume
src/components/rail/Rail.tsx
src/components/rail/Queue.tsx
src/components/rail/Chat.tsx
src/components/members/MemberStack.tsx
src/components/members/MemberPanel.tsx
src/components/ui/Button.tsx, Input.tsx, Toast.tsx, Sheet.tsx
```

## 13. Backend change for avatars

The avatar must be visible to other people, so it needs to be stored with the member. Update `schema.sql` and the tests:

1. `alter table public.room_members add column avatar text;` (nullable, format `"<icon>:<color>"`, validate with a check constraint `avatar ~ '^[a-z-]{2,20}:[a-z]{2,10}$'`).
2. `create_room(p_name text, p_avatar text default null)` and `join_room(p_code text, p_name text, p_avatar text default null)` store it (and update it on rejoin).
3. The client reads avatars from `room_members` and looks them up by `user_id` for the header stack, member panel, queue "Added by", and chat. Members who left fall back to the initial.
4. Volume and skin are local only and do not touch the backend.
5. Add an RPC test for avatar validation (rejects junk strings) and a test that rejoining updates the avatar.

## 14. Accessibility and quality floor

- Visible keyboard focus everywhere. All controls reachable with Tab. Space or Enter activates buttons. Arrow keys adjust sliders.
- Text contrast at least 4.5:1 on its background (3:1 for large text and icons). Check `--paper-500` on `--walnut-900` and fix the token if it fails.
- The click wheel, tonearm, and reels are decorative. The real controls are the buttons and sliders with labels.
- `prefers-reduced-motion` handled as described in 3.4.
- The page never scrolls horizontally, and the room shell never scrolls vertically.
- Song titles never exceed two lines on the stage or one line in lists.
- Touch targets at least 44 px.

## 15. Build order

1. Tokens, fonts, global styles, `Wordmark`, `Button`, `Input`, grain overlay.
2. `Avatar`, `AvatarPicker`, Onboarding, Home, Room ready, Join code. Backend avatar change and tests.
3. Room shell: header, responsive layout, Rail (Queue and Chat restyled), member stack and panel, mobile tabs and mini-player.
4. Stage common parts: song title block, seek bar, volume, `VideoDock`, "Tap to join the music" overlay.
5. Turntable skin, with `useSpin`. Then Cassette. Then iPod, with the click wheel gestures. Then the skin switcher and the power-on moment.
6. Polish: reduced motion, offline card, empty and error states, toasts, focus states.
7. Visual and functional verification (below).

## 16. Acceptance checks

Run the existing test suites first; **nothing from earlier milestones may break** (sync, queue, chat, host transfer, kick, close, rejoin). Then add:

- **Playwright screenshots** at 390x844, 768x1024, 1366x768, 1920x1080 for: Onboarding, Home, Room ready, Join, and Room with each of the three skins (playing and paused), with a very long song title (150 characters) and with 12 songs and 30 chat messages. Review the screenshots yourself and fix anything that clips, overlaps, or wastes space.
- **Assertions:** no horizontal scroll at any size; `document.scrollingElement.scrollHeight <= innerHeight` inside the room; stage title is at most 2 lines; header never wraps; chat input always visible without scrolling.
- **Behavior tests:** onboarding blocks an empty name; picked avatar shows up for the other two browser contexts in the member stack and chat; Surprise me changes the avatar; skin choice persists across reload and does not interrupt playback; switching skins keeps the YouTube iframe mounted (same element); volume slider and click wheel both change volume; click wheel scroll moves the queue highlight; Room ready shows the same code the room uses and the copied link joins correctly; join-by-link with no profile goes through onboarding then joins.
- **Accessibility:** run axe (`@axe-core/playwright`) on each screen and fix serious and critical issues.
- Append a "UI notes" section to `DECISIONS.md` with any judgment calls and update `README.md` with the new screens and skins.

## 17. Assumptions made (change if wrong)

- Skin choice is per person, not shared with the room.
- Avatars are a built-in set of 12 icons with 8 ring colors, not photo uploads.
- Volume is per person (it changes only that person's player).
- The look is dark only. There is no light theme.
- Only English copy.
