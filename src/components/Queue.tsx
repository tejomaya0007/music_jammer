import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  DndContext, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRoomStore, type RoomState } from '../state/roomStore';
import { addLinks, moveSong, playSong, removeSong } from '../state/session';
import type { SongRow } from '../lib/api';
import { GripIcon, TrashIcon } from './icons';
import { QUEUE_CAP } from '../lib/config';

const selectQueue = (s: RoomState) => s.songs;
const selectMembers = (s: RoomState) => s.members;

export function Queue() {
  const songs = useRoomStore(selectQueue);
  const members = useRoomStore(selectMembers);
  // selectors must return stable references; build the lookup from the array instead
  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.name])), [members]);
  const currentId = useRoomStore((s) => s.room?.current_song_id ?? null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = songs.findIndex((s) => s.id === active.id);
    const to = songs.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    // the new index in the full list is where the item lands after arrayMove
    const toIndex = arrayMove(songs, from, to).findIndex((s) => s.id === active.id);
    void moveSong(String(active.id), toIndex);
  };

  return (
    <section aria-label="Queue">
      <div className="section-head">
        <h2>Queue</h2>
        <span className="hint num">{songs.length} / {QUEUE_CAP}</span>
      </div>

      <AddBar />

      {songs.length === 0 ? (
        <p className="empty">Nothing queued yet. Paste a YouTube link above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="queue">
              {songs.map((s, i) => (
                <QueueRow
                  key={s.id}
                  song={s}
                  current={s.id === currentId}
                  dragging={s.id === activeId}
                  addedBy={s.added_by ? names.get(s.added_by) : undefined}
                  duplicate={songs.findIndex((x) => x.video_id === s.video_id) < i}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function QueueRow({ song, current, dragging, addedBy, duplicate }: {
  song: SongRow; current: boolean; dragging: boolean; addedBy?: string; duplicate: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isLifted = dragging || isDragging;

  return (
    <li ref={setNodeRef} style={style} className={`row${current ? ' current' : ''}${isLifted ? ' dragging' : ''}`}>
      <button
        className="grip"
        aria-label={`Drag ${song.title} to reorder`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <img className="thumb" src={song.thumbnail ?? ''} alt="" loading="lazy" />
      <button className="row-play" onClick={() => void playSong(song.id)} aria-label={`Play ${song.title}`}>
        <span className="meta">
          <span className="t">{song.title}</span>
          <span className="by">
            {current ? 'Playing' : addedBy ? `Added by ${addedBy}` : 'Added'}
            {duplicate ? ' · already in queue' : ''}
          </span>
        </span>
      </button>
      <div className="actions">
        <button className="icon-btn" onClick={() => void removeSong(song.id)} aria-label={`Remove ${song.title}`}>
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function AddBar() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const ok = await addLinks(text);
      if (ok) setText('');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form className="add-bar" onSubmit={submit}>
      <label className="sr-only" htmlFor="add-links">YouTube links to add</label>
      <textarea
        id="add-links"
        className="input"
        rows={1}
        value={text}
        placeholder="Paste a YouTube link, or several"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        spellCheck={false}
        autoComplete="off"
      />
      <button className="btn primary" type="submit" disabled={busy || !text.trim()}>Add</button>
    </form>
  );
}
