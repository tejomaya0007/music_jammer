import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPlayer, type Player } from '../lib/player';
import { driftCorrectionTarget, expectedPositionMs, nextDriftRate } from '../lib/sync';
import { selectCurrentSong, toast, useRoomStore } from '../state/roomStore';
import { currentPosMs, reportSongEnded, serverNowMs } from '../state/session';

const DRIFT_LOOP_MS = 1000;
/**
 * A freshly loaded video reports a stale or zero clock until it starts. Seeking then restarts the load,
 * which is the stammer on joined phones. Leave it alone until it plays (or this much time passes).
 */
const SETTLE_MS = 8_000;

/**
 * Connects the video player to the shared room state.
 * The rooms row is the source of truth; this hook only moves the local player to match it.
 * Nothing touches the player until the user taps "Tap to join the music" (autoplay rules).
 */
export function usePlayer(mountRef: RefObject<HTMLDivElement | null>): Player | null {
  const [player, setPlayer] = useState<Player | null>(null);
  const loadedSongId = useRef<string | null>(null);
  const buffering = useRef(false);
  const settleUntil = useRef(0);
  const song = useRoomStore(selectCurrentSong);
  const unlocked = useRoomStore((s) => s.unlocked);
  const isPlaying = useRoomStore((s) => s.room?.is_playing ?? false);
  const anchorPos = useRoomStore((s) => s.room?.anchor_pos_ms ?? 0);
  const anchorTime = useRoomStore((s) => s.room?.anchor_time ?? '');
  const version = useRoomStore((s) => s.room?.state_version ?? 0);
  const volume = useRoomStore((s) => s.volume);

  // create the player once the room screen (and its mount point) is on screen
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let p: Player | null = null;
    let unsub: (() => void) | null = null;
    createPlayer(mount).then((created) => {
      if (cancelled) {
        created.destroy();
        return;
      }
      p = created;
      unsub = created.onEvent((e) => {
        const id = loadedSongId.current;
        if (e.type === 'buffering') buffering.current = true;
        if (e.type === 'playing' || e.type === 'paused') {
          buffering.current = false;
          settleUntil.current = 0;
        }
        if (!id) return;
        // a skip is reported only for a real end (near the length) ...
        if (e.type === 'ended') {
          const dur = created.getDuration();
          if (dur > 0 && created.getCurrentTime() >= dur - 2) void reportSongEnded(id, false);
        }
        // ... or for a video that cannot play here at all. Other errors (a phone blocking autoplay,
        // a hiccup in the browser) must not skip the room: tell this person and let them retry.
        if (e.type === 'error') {
          // show the YouTube error number so the cause is visible (also in the browser console)
          console.warn('[jam] YouTube error', e.code, 'for song', id);
          if (e.code === 100 || e.code === 101 || e.code === 150) {
            toast(`YouTube blocks this video here (error ${e.code}). Skipping.`, 'error');
            void reportSongEnded(id, true);
          } else {
            toast(`Could not play here (YouTube error ${e.code ?? 'unknown'}). Tap Join the music to try again.`, 'error');
          }
        }
      });
      setPlayer(created);
    });
    return () => {
      cancelled = true;
      unsub?.();
      p?.destroy();
      loadedSongId.current = null;
      setPlayer(null);
    };
  }, [mountRef]);

  // this person's volume only, applied whenever the player is ready or the slider moves
  useEffect(() => {
    player?.setVolume(volume);
  }, [player, volume]);

  // apply the shared state whenever it changes
  useEffect(() => {
    if (!player || !unlocked) return;
    const s = useRoomStore.getState().room;
    if (!song || !s) {
      if (loadedSongId.current) player.stop();
      loadedSongId.current = null;
      return;
    }
    const expectedSec = currentPosMs() / 1000;
    if (loadedSongId.current !== song.id) {
      loadedSongId.current = song.id;
      settleUntil.current = Date.now() + SETTLE_MS;
      player.load(song.video_id, expectedSec, isPlaying);
      // the seek bar needs the length straight away, or it clamps to 0:01 until the next tick
      useRoomStore.setState({ durationSec: player.getDuration() });
      return;
    }
    // always send the room's state: YouTube reports BUFFERING (not PLAYING) while a video stalls,
    // so checking isPlaying() first let a pause go unsent. play and pause are idempotent.
    if (isPlaying) player.play();
    else player.pause();
    // an explicit change (seek, pause, skip) corrects at once, no cool-down
    const driftMs = Math.abs(player.getCurrentTime() * 1000 - expectedSec * 1000);
    // while the new video is still starting, its clock is not real yet: wait for it to settle
    if (driftMs > 300 && Date.now() >= settleUntil.current) player.seekTo(expectedSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the shared state fields
  }, [player, unlocked, song?.id, song?.video_id, isPlaying, anchorPos, anchorTime, version]);

  // slow drift loop: keep friends within about a second while playing
  useEffect(() => {
    if (!player) return;
    let lastCorrection = 0;
    const rate = { current: 1 };
    // one drift check; the rooms row is the truth, the player follows it
    const check = (cooldown: boolean) => {
      const st = useRoomStore.getState();
      if (!st.unlocked || !st.room || !loadedSongId.current) return;
      const duration = player.getDuration();
      if (duration !== st.durationSec) useRoomStore.setState({ durationSec: duration });
      const playerPosMs = player.getCurrentTime() * 1000;
      const expectedMs = expectedPositionMs(
        { anchorPosMs: st.room.anchor_pos_ms, anchorTimeMs: new Date(st.room.anchor_time).getTime(), isPlaying: st.room.is_playing },
        serverNowMs(),
      );
      // a big gap: one seek (rare, cooled down). A small gap: a gentle speed change, never a seek.
      const target = driftCorrectionTarget({
        playerPosMs, expectedMs,
        isPlaying: st.room.is_playing,
        buffering: buffering.current,
        nowMs: Date.now(),
        lastCorrectionMs: cooldown ? lastCorrection : 0,
      });
      // speed only changes when it must: setting the same rate again makes some phones re-buffer
      const setRate = (r: number) => {
        if (rate.current === r) return;
        rate.current = r;
        player.setPlaybackRate(r);
      };
      if (Date.now() < settleUntil.current) {
        setRate(1);
        return;
      }
      if (target !== null) {
        player.seekTo(target / 1000);
        setRate(1);
        lastCorrection = Date.now();
        useRoomStore.setState({ lastCorrectionMs: lastCorrection });
      } else if (st.room.is_playing && !buffering.current) {
        setRate(nextDriftRate(rate.current, playerPosMs, expectedMs));
      } else {
        setRate(1);
      }
    };
    const timer = setInterval(() => check(true), DRIFT_LOOP_MS);
    return () => clearInterval(timer);
  }, [player]);

  return player;
}
