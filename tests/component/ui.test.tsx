// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import type { ReactNode } from 'react';

afterEach(() => cleanup());

// The backend is replaced with a recording fake: these tests check UI behaviour, not SQL.
const fake = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcResult: undefined as unknown,
  rpcError: null as string | null,
  rpc: async function (fn: string, args: Record<string, unknown>) {
    fake.calls.push({ fn, args });
    if (fake.rpcError) throw new Error(fake.rpcError);
    return fake.rpcResult;
  },
}));
vi.mock('../../src/lib/backend', () => ({
  backend: {
    signIn: async () => 'me-user',
    rpc: (fn: string, args: Record<string, unknown>) => fake.rpc(fn, args),
    snapshot: async () => ({ room: null, songs: [], members: [], messages: [] }),
    subscribe: () => () => undefined,
  },
}));

import { Home } from '../../src/components/Home';
import { Toasts } from '../../src/components/Toasts';
import { NowPlaying } from '../../src/components/NowPlaying';
import { ChatBar } from '../../src/components/Chat';
import { Queue } from '../../src/components/Queue';
import { Sheet } from '../../src/components/parts';
import { useRoomStore, toast } from '../../src/state/roomStore';
import type { RoomRow, SongRow, MemberRow } from '../../src/lib/api';
import { createRef } from 'react';

const room = (over: Partial<RoomRow> = {}): RoomRow => ({
  id: 'r1', code: 'ABC123', host_id: 'me-user', status: 'active', current_song_id: null, is_playing: false,
  anchor_pos_ms: 0, anchor_time: new Date(0).toISOString(), state_version: 1, max_members: 10,
  last_activity_at: new Date().toISOString(), created_at: new Date().toISOString(), ...over,
});
const song = (id: string, title: string, over: Partial<SongRow> = {}): SongRow => ({
  id, room_id: 'r1', video_id: `vid${id}`.padEnd(11, 'x').slice(0, 11), title, thumbnail: `https://i.ytimg.com/vi/${id}/mq.jpg`,
  added_by: 'me-user', position: Number(id.replace(/\D/g, '')) || 1, created_at: new Date().toISOString(), ...over,
});
const member = (user_id: string, name: string): MemberRow => ({ user_id, name, joined_at: new Date().toISOString(), is_kicked: false });

function wrap(ui: ReactNode) {
  return (
    <>
      {ui}
      <Toasts />
    </>
  );
}

beforeEach(() => {
  fake.calls.length = 0;
  fake.rpcResult = undefined;
  fake.rpcError = null;
  useRoomStore.setState({
    booted: true, userId: 'me-user', name: 'Ana', roomId: null, code: null, room: null, songs: [], members: [],
    messages: [], online: [], unlocked: false, unread: 0, chatOpen: false, toasts: [], pending: 0, durationSec: 0, pendingRoom: null,
  });
  localStorage.clear();
});

describe('Home', () => {
  it('asks for a name before creating a room', async () => {
    render(wrap(<Home inviteCode={null} />));
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(await screen.findByText('Add your name to start')).toBeInTheDocument();
    expect(fake.calls.find((c) => c.fn === 'create_room')).toBeUndefined();
  });

  it('create shows the new room code before any entering happens', async () => {
    fake.rpcResult = { id: 'r1', code: 'ABC123' };
    render(wrap(<Home inviteCode={null} />));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Ana  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(fake.calls.find((c) => c.fn === 'create_room')?.args).toEqual({ p_name: 'Ana' });
    expect(useRoomStore.getState().roomId).toBeNull();
    expect(localStorage.getItem('jam:name')).toBe('Ana');
  });

  it('Open room enters the room', async () => {
    fake.rpcResult = { id: 'r1', code: 'ABC123' };
    render(wrap(<Home inviteCode={null} />));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open room' }));
    await waitFor(() => expect(useRoomStore.getState().pendingRoom).toBeNull());
  });

  it('join a room asks for a code, uppercases it, and joins', async () => {
    render(wrap(<Home inviteCode={null} />));
    fireEvent.click(screen.getByRole('button', { name: 'Join a room' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Bo' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'abc123' } });
    expect(screen.getByLabelText('Room code')).toHaveValue('ABC123');
    fireEvent.click(screen.getByRole('button', { name: 'Join the room' }));
    await waitFor(() => expect(fake.calls.find((c) => c.fn === 'join_room')?.args).toEqual({ p_code: 'ABC123', p_name: 'Bo' }));
  });

  it('an invite link opens the join form with the code filled in', () => {
    render(wrap(<Home inviteCode="abc123" />));
    expect(screen.getByLabelText('Room code')).toHaveValue('ABC123');
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'xyz' } });
    expect(screen.getByLabelText('Room code')).toHaveValue('XYZ');
  });

  it('shows the join error from the database as-is', async () => {
    fake.rpcError = 'Room not found or closed';
    render(wrap(<Home inviteCode={null} />));
    fireEvent.click(screen.getByRole('button', { name: 'Join a room' }));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Bo' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'NOPE42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join the room' }));
    expect(await screen.findByText('Room not found or closed')).toBeInTheDocument();
  });
});

describe('NowPlaying', () => {
  it('shows the tap-to-join gate until the first tap, then unlocks the player', () => {
    useRoomStore.setState({ roomId: 'r1', room: room({ current_song_id: 's1', is_playing: true }), songs: [song('s1', 'Blue')] });
    render(<NowPlaying mountRef={createRef<HTMLDivElement>()} />);
    expect(screen.getByText('Tap to join the music')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Join in' }));
    expect(useRoomStore.getState().unlocked).toBe(true);
    expect(screen.queryByText('Tap to join the music')).toBeNull();
  });

  it('says what to do when the queue is empty', () => {
    useRoomStore.setState({ roomId: 'r1', room: room() });
    render(<NowPlaying mountRef={createRef<HTMLDivElement>()} />);
    expect(screen.getByText('Add a link to start the jam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('shows the title, who added it, and the play/pause state', () => {
    useRoomStore.setState({
      roomId: 'r1', unlocked: true, room: room({ current_song_id: 's1', is_playing: false }),
      songs: [song('s1', 'Blue in Green')], members: [member('me-user', 'Ana')],
    });
    render(<NowPlaying mountRef={createRef<HTMLDivElement>()} />);
    expect(screen.getByRole('heading', { name: 'Blue in Green' })).toBeInTheDocument();
    expect(screen.getByText('Added by Ana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });
});

describe('Queue', () => {
  it('lists songs in order, marks the playing one, and flags duplicates', () => {
    useRoomStore.setState({
      roomId: 'r1',
      room: room({ current_song_id: 's2' }),
      members: [member('me-user', 'Ana')],
      songs: [
        song('s1', 'First', { video_id: 'AAAAAAAAAAA' }),
        song('s2', 'Second', { video_id: 'BBBBBBBBBBB' }),
        song('s3', 'Again', { video_id: 'AAAAAAAAAAA' }),
      ],
    });
    render(wrap(<Queue />));
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveClass('current');
    expect(screen.getByText(/already in queue/)).toBeInTheDocument();
    expect(screen.getByText('3 / 200')).toBeInTheDocument();
  });

  it('removing a song calls remove_song with its id', async () => {
    useRoomStore.setState({ roomId: 'r1', room: room(), songs: [song('s1', 'Only')] });
    render(wrap(<Queue />));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Only' }));
    await waitFor(() => expect(fake.calls.find((c) => c.fn === 'remove_song')?.args).toEqual({ p_song: 's1' }));
  });
});

describe('ChatBar', () => {
  it('shows an unread count when the drawer is closed', () => {
    useRoomStore.setState({ unread: 3, chatOpen: false });
    render(<ChatBar />);
    expect(screen.getByRole('button', { name: 'Chat, 3 unread' })).toHaveTextContent('3');
  });

  it('opens the drawer on tap and clears the count', () => {
    useRoomStore.setState({ unread: 2, chatOpen: false, roomId: 'r1', room: room(), messages: [] });
    render(<ChatBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat, 2 unread' }));
    expect(useRoomStore.getState().chatOpen).toBe(true);
    expect(useRoomStore.getState().unread).toBe(0);
  });
});

describe('Sheet', () => {
  it('closes on Escape and on the scrim', () => {
    const onClose = vi.fn();
    const { container } = render(<Sheet title="Test" onClose={onClose}><p>body</p></Sheet>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.scrim')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('toasts', () => {
  it('shows a message and removes it after its timeout', async () => {
    vi.useFakeTimers();
    try {
      render(<Toasts />);
      act(() => toast('Saved'));
      expect(screen.getByText('Saved')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.queryByText('Saved')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
