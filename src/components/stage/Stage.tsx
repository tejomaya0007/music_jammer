import { useEffect, useMemo, useState } from 'react';
import { selectCurrentSong, setVolume, toast, useRoomStore } from '../../state/roomStore';
import { currentPosMs, next, playPause, playSong, prev, unlockMusic } from '../../state/session';
import { useSkin, type Skin } from '../../hooks/useSkin';
import { Avatar } from '../avatar/Avatar';
import { SkinSwitcher } from './SkinSwitcher';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { Turntable } from '../skins/Turntable';
import { Cassette } from '../skins/Cassette';
import { IPod } from '../skins/IPod';
import type { SkinProps } from '../skins/types';

/** The stage: skin switcher, the device, title, seek, and (iPod) volume. */
export function Stage({ showVideo, onToggleVideo }: { showVideo: boolean; onToggleVideo: () => void }) {
  const [skin, setSkin] = useSkin();
  const song = useRoomStore(selectCurrentSong);
  const songs = useRoomStore((s) => s.songs);
  const currentId = useRoomStore((s) => s.room?.current_song_id ?? null);
  const isPlaying = useRoomStore((s) => s.room?.is_playing ?? false);
  const unlocked = useRoomStore((s) => s.unlocked);
  const durationSec = useRoomStore((s) => s.durationSec);
  const volume = useRoomStore((s) => s.volume);
  const adder = useRoomStore((s) => (song ? s.members.find((m) => m.user_id === song.added_by) : undefined));

  // position moves with the room clock; read four times a second, not stored
  const [positionMs, setPositionMs] = useState(0);
  useEffect(() => {
    const tick = () => setPositionMs(currentPosMs());
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [song?.id, isPlaying]);

  const addedBy = adder?.name ?? 'someone';
  const skinProps: SkinProps = useMemo(() => ({
    song,
    isPlaying,
    positionMs,
    durationMs: durationSec * 1000,
    volume,
    onPlayPause: () => void playPause(),
    onNext: () => void next(),
    onPrev: () => void prev(),
    onVolume: setVolume,
  }), [song, isPlaying, positionMs, durationSec, volume]);

  return (
    <section className="stage" aria-label="Now playing">
      <div className="stage-top">
        <SkinSwitcher skin={skin} onChange={(s: Skin) => setSkin(s)} />
        <button type="button" className={`video-toggle${showVideo ? ' on' : ''}`} aria-pressed={showVideo} onClick={onToggleVideo} disabled={!song}>
          {showVideo ? 'Hide video' : 'Show video'}
        </button>
      </div>

      <div className={`device-slot skin-${skin}`}>
        {skin === 'turntable' && <Turntable {...skinProps} />}
        {skin === 'cassette' && <Cassette {...skinProps} />}
        {skin === 'ipod' && (
          <IPod {...skinProps} addedBy={addedBy} songs={songs} currentId={currentId} onPlaySong={(id) => void playSong(id)} />
        )}

        {song && !unlocked && (
          <div className="tap-join" role="group" aria-label="Start playback">
            <p className="tap-join-title">Join the music</p>
            <p className="tap-join-sub">Your browser needs one tap before it can play sound.</p>
            <button type="button" className="btn primary big" onClick={() => { unlockMusic(); toast('Playing with the room'); }}>
              Join the music
            </button>
          </div>
        )}
      </div>

      <div className="track">
        <h2 className="track-title" title={song?.title}>{song?.title ?? 'Nothing playing yet'}</h2>
        {song ? (
          <p className="track-by">
            <Avatar value={adder?.avatar} name={addedBy} size={24} />
            <span>Added by {addedBy}</span>
          </p>
        ) : (
          <p className="track-by muted">Paste a link in the queue to start the room.</p>
        )}
      </div>

      <SeekBar positionSec={positionMs / 1000} durationSec={durationSec} disabled={!song} />

      {skin === 'ipod' && <VolumeControl value={volume} />}
    </section>
  );
}

