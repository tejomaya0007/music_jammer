# Jam Room: Context and Functional Spec

## 1. What this is

A web app (PWA, opened in Brave or any browser) where friends join a shared "jam room" and listen to YouTube songs together, in sync, from different places. Think Spotify Jam, but built on YouTube links so nobody needs a Spotify subscription.

**Audience:** me and my friends only. Not being published to any app store, so no public-release or legal constraints drive the design.

**Playback approach:** the official YouTube IFrame Player plays inside the app. The video is kept tiny or covered by an overlay UI, so the experience is audio-first with a thumbnail and title. We do not extract or download audio.

## 2. Scope

### In scope (v1)
- Create a room, get a join code and a share link
- Join by code or link, with a display name (no accounts)
- Live member list and online count
- Shared queue: paste YouTube links, reorder by drag, remove
- Synced playback: play, pause, next, previous, seek
- Room chat
- Leave a room, host transfer, rooms that keep running without the creator
- Solo use (a room with one person works fully)

### Out of scope (v1)
- Offline mode and local file hosting
- Hybrid mode
- Bluetooth / BLE mesh
- Native mobile apps
- Spotify or other sources
- Public rooms, discovery, accounts, passwords

These can come later; the schema does not block any of them.

## 3. Core concepts

| Concept | Meaning |
|---|---|
| **Room** | A shared session with a unique 6-character code, a queue, playback state and chat |
| **Member** | A person who has joined a room (anonymous identity plus display name) |
| **Host** | The member with admin powers in the room. Starts as the creator, can transfer |
| **Queue** | Ordered list of songs in the room. Songs are not deleted after playing |
| **Now playing** | A pointer into the queue plus an anchored position/time used for sync |
| **Presence** | Who is online right now (live), separate from who is a member (stored) |

## 4. Functional spec

### 4.1 Identity
- On first open, the app signs the user in anonymously (Supabase anonymous auth) so they get a stable user ID without making an account.
- The user enters a display name once. It is stored locally and sent when joining a room. It can be changed in a room.
- If browser storage is cleared, the user becomes a new anonymous user with a new name prompt. Acceptable for this scope.

### 4.2 Create a room
1. User taps **Create Jam** and (if needed) enters a display name.
2. Server generates a 6-character code from an unambiguous alphabet (no 0/O, 1/I/L) and creates the room.
3. Creator becomes a member and the **host**.
4. Creator lands in the empty room. The Share button copies the link (`?join=<CODE>`) and shows the code.
5. The room works immediately with one person. No one else needs to join.

### 4.3 Join a room
- **By code:** type the code on the home screen. Codes are case-insensitive.
- **By link:** opening `https://<site>/?join=<CODE>` goes straight to joining (asks for a display name if none is stored).
- Server checks that the code exists and the room is not closed. Otherwise show "Room not found or closed."
- Joining adds the user to the room's members (once; rejoining reuses the same membership row).
- Everyone already in the room sees the new member appear and a short "X joined" notice in chat.
- A late joiner receives the current state: queue, now-playing, and chat history. If something is playing, they jump to the correct position after tapping **Tap to join the music** (needed because browsers block autoplay until the user taps once).
- Room size cap: 10 members for v1 (configurable).

### 4.4 Members and presence
- The member bar shows every member as online (live) or offline (member but not currently connected), with a count like "3 online".
- Online status comes from Supabase Presence on the room's channel. It updates automatically when a tab closes or the phone loses connection.
- The host has a crown badge.

### 4.5 Leaving, disconnecting, and the room keeps running
Two different things happen, and they are handled differently.

**Disconnect** (closed tab, lost signal, phone locked for long)
- The person stays a member and shows as offline. On return they re-enter the room and re-sync automatically.
- Nothing else changes for the other members.

**Leave** (user taps **Leave room**)
- Their membership is removed. Others see "X left" in chat and the online count drops.
- To come back they use the code or link again.
- Leaving only affects that person's own player. The room and the music continue for everyone else.

**Host leaves or disappears** (the creator or current host)
- The room does **not** end. Music keeps playing for the others.
- Host passes automatically to the member who has been in the room longest and is currently online.
- If the host merely disconnects, host passes after the host has been unreachable for about 40 seconds. If they return later they rejoin as a normal member (the host can hand the role back by transfer).
- The new host sees a one-time notice ("You're now the host").

**Last person leaves or goes offline**
- Playback is paused and the room goes idle, keeping its queue and chat.
- Anyone with the code can rejoin while the room is idle. The first person back resumes it, paused, at the position where it stopped.
- Idle rooms with no activity for 24 hours are deleted automatically.

**Host can also**
- Remove (kick) a member
- Transfer host to a chosen member
- Close the room for everyone (confirmation required)

### 4.6 Solo mode
- A room with a single member behaves exactly like a normal room. It is a personal queue with chat disabled in effect (nobody to read it).
- Friends can join at any time later using the same code.

### 4.7 Playback controls
Everyone in the room can control playback (friends-only scope). A host-only-controls toggle exists for later.

- **Play / Pause:** updates the shared state; every client follows.
- **Next / Previous:** moves the now-playing pointer. At the end of the queue, Next stops playback. Previous from the first song restarts it. If the current song is more than 5 seconds in, Previous restarts the song instead of going back.
- **Seek:** a seek bar sets a new position for everyone.
- **Auto-advance:** when a song ends, the room moves to the next song. Every client reports the end, and the server only acts on the first report for the song that is still current, so duplicate reports are harmless.
- **Unplayable video** (removed, private, embedding disabled): the client that hits the error reports it, the room skips to the next song, and chat shows "Couldn't play 'Title', skipped."
- **Sync:** all clients derive their position from one shared anchor, correct for clock differences, and re-seek if they drift more than about 300 ms. For friends in different places, up to about 1 second of difference is fine.

### 4.8 Queue
- **Add song:** paste a link into the Add bar. Accepts `youtu.be/ID`, `youtube.com/watch?v=ID`, `music.youtube.com/...`, `youtube.com/shorts/ID`, and embed links. Invalid links show an error.
- On add, the app fetches the title and thumbnail from YouTube's oEmbed endpoint (no API key needed) and stores them with the song.
- If nothing is playing, the first added song starts playing automatically.
- **Reorder:** drag a song to a new position. Everyone's list updates live. Dragging the currently playing song does not interrupt it.
- **Remove:** any member can remove a song. Removing the currently playing song skips to the next.
- Each song shows who added it.
- Duplicates are allowed, with a small "already in queue" hint.
- Queue cap: 200 songs for v1.
- Adding a playlist link is out of scope for v1 (single video links only).

### 4.9 Chat
- Plain text messages, visible to everyone in the room, newest at the bottom.
- History is stored and loaded when joining.
- System lines for joins, leaves, host changes, and skipped songs.
- Message length cap: 500 characters. Light rate limit to prevent flooding.
- Unread badge when the chat panel is collapsed.

### 4.10 Sharing
- **Share** button copies the join link and shows the code.
- On phones, uses the native share sheet when available.

### 4.11 Background play
- The YouTube player must stay mounted and not `display:none` (some browsers pause hidden iframes). It is shrunk or covered instead.
- Media Session API provides lock-screen and notification controls (play, pause, next, previous) with title and thumbnail.
- Brave on Android needs its background-play setting on. To be tested on each friend's device early. iOS is stricter and may not allow it.

## 5. Edge cases to handle

| Situation | Behavior |
|---|---|
| Two people press Next at the same moment | Server applies actions in order; the second Next applies to the new state. Use an action version check so a stale click is ignored |
| Someone's phone clock is wrong | Clients sync to server time, never trust their own clock |
| Network drops mid-song | On reconnect the client re-fetches room state and re-syncs |
| Browser blocks autoplay | Show "Tap to join the music" overlay |
| Room code typo | "Room not found" |
| Closed room link opened | "This room was closed" |
| Kicked member returns | Blocked from rejoining that room for the same code |
| Everyone offline mid-song | Room pauses; resumes paused when someone returns |

## 6. Non-functional goals
- Works on a mid-range Android phone in Brave.
- Join to first sound in under about 10 seconds on a normal connection.
- Free tier only: Supabase free plan plus static hosting.
- Simple enough to build and debug alone.

## 7. Decisions made
1. Frontend: Vite + React + TypeScript, built as an installable PWA (see `architecture.md`).
2. Backend: Supabase only (auth, database, realtime, SQL functions). No separate server.
3. Everyone in the room can control playback.
4. Max room size: 10.
5. A kicked member cannot rejoin that room.
6. Source of truth for tables, security rules and server functions: `schema.sql`.

## 8. Milestones
1. **M1:** Two browser tabs in one room, a pasted link plays synced in both.
2. **M2:** Queue with add, remove, reorder, next, previous, auto-advance.
3. **M3:** Members, presence, leave, host transfer, idle and cleanup.
4. **M4:** Chat and system messages.
5. **M5:** Overlay UI, Media Session, background-play testing on real phones.
6. **M6 (later):** Offline and hybrid modes, local file sharing, BLE mesh.
