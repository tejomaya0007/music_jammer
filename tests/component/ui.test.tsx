// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

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

import { Onboarding } from '../../src/screens/Onboarding';
import { Home } from '../../src/screens/Home';
import { JoinCode } from '../../src/screens/JoinCode';
import { RoomReady } from '../../src/screens/RoomReady';
import { Toasts } from '../../src/components/Toasts';
import { SeekBar } from '../../src/components/stage/SeekBar';
import { VolumeControl } from '../../src/components/stage/VolumeControl';
import { ChatPanel } from '../../src/components/Chat';
import { useRoomStore, toast } from '../../src/state/roomStore';
import { parseAvatar, AVATAR_ICONS, AVATAR_COLOR_IDS } from '../../src/lib/avatars';
import { readProfile, saveProfile } from '../../src/lib/profile';
import { AvatarPicker } from '../../src/components/avatar/AvatarPicker';
import { parseVideoLinks } from '../../src/lib/link';

afterEach(() => cleanup());

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
    messages: [], online: [], unlocked: false, unread: 0, chatOpen: false, toasts: [], pending: 0, durationSec: 0,
    pendingRoom: null, invite: null,
  });
  localStorage.clear();
});

describe('onboarding', () => {
  it('Continue stays disabled until a name is typed', () => {
    render(<Onboarding onDone={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana' } });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('saves the name and a valid avatar, then reports done', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith('Ana');
    const p = readProfile();
    expect(p?.name).toBe('Ana');
    expect(parseAvatar(p?.avatar)).not.toBeNull();
  });
});

describe('avatar picker', () => {
  it('offers 12 icons and 8 ring colours, and Surprise me changes the face', () => {
    const changes: Array<{ icon: string; color: string }> = [];
    const value = { icon: 'vinyl' as const, color: 'amber' as const };
    render(<AvatarPicker value={value} onChange={(a) => changes.push(a)} />);
    expect(screen.getAllByRole('radio', { name: /.+/ })).toHaveLength(AVATAR_ICONS.length + AVATAR_COLOR_IDS.length);
    fireEvent.click(screen.getByRole('radio', { name: 'cassette' }));
    expect(changes.at(-1)).toEqual({ icon: 'cassette', color: 'amber' });
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }));
    expect(changes.length).toBe(2);
  });
});

describe('home', () => {
  beforeEach(() => saveProfile({ name: 'Ana', avatar: 'vinyl:amber' }));

  it('shows the two large choices', () => {
    render(wrap(<Home onJoin={() => undefined} onEditProfile={() => undefined} />));
    expect(screen.getByRole('button', { name: /Start a room/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Join with a code/ })).toBeInTheDocument();
  });

  it('start creates the room and keeps its code for the ticket screen', async () => {
    fake.rpcResult = { id: 'r1', code: 'ABC123' };
    render(wrap(<Home onJoin={() => undefined} onEditProfile={() => undefined} />));
    fireEvent.click(screen.getByRole('button', { name: /Start a room/ }));
    await waitFor(() => expect(useRoomStore.getState().pendingRoom).toEqual({ id: 'r1', code: 'ABC123' }));
    expect(fake.calls.find((c) => c.fn === 'create_room')?.args).toEqual({ p_name: 'Ana', p_avatar: 'vinyl:amber' });
    expect(useRoomStore.getState().roomId).toBeNull();
  });
});

describe('ticket', () => {
  it('shows the code, copies it, and enters the room on Enter room', async () => {
    useRoomStore.setState({ pendingRoom: { id: 'r1', code: 'ABC123' } });
    render(wrap(<RoomReady code="ABC123" />));
    expect(screen.getByLabelText('Room code ABC123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enter room' }));
    await waitFor(() => expect(useRoomStore.getState().pendingRoom).toBeNull());
  });
});

describe('join by code (six boxes)', () => {
  it('auto-advances on type, fills all six on paste, and blocks Join until complete', () => {
    render(wrap(<JoinCode onBack={() => undefined} />));
    const boxes = screen.getAllByRole('textbox');
    expect(boxes).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Join room' })).toBeDisabled();
    fireEvent.change(boxes[0], { target: { value: 'k' } });
    expect(boxes[0]).toHaveValue('K');
    fireEvent.change(boxes[1], { target: { value: '7' } });
    expect(boxes[1]).toHaveValue('7');
  });

  it('only accepts the code alphabet (no 0, O, 1, I, L)', () => {
    render(wrap(<JoinCode onBack={() => undefined} />));
    const first = screen.getAllByRole('textbox')[0];
    fireEvent.change(first, { target: { value: 'O' } });
    expect(first).toHaveValue('');
    fireEvent.change(first, { target: { value: 'L' } });
    expect(first).toHaveValue('');
  });

  it('a pasted code fills the boxes and enables Join', () => {
    render(wrap(<JoinCode onBack={() => undefined} />));
    const boxes = screen.getAllByRole('textbox');
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => 'abc234' } });
    expect(boxes.map((b) => (b as HTMLInputElement).value).join('')).toBe('ABC234');
    expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled();
  });

  it('shows the database message inline, as the server returns it', async () => {
    fake.rpcError = 'Room not found or closed';
    render(wrap(<JoinCode initial="NPE423" onBack={() => undefined} />));
    saveProfile({ name: 'Bo', avatar: 'radio:sky' });
    fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code doesn't match a room");
  });
});

describe('stage controls', () => {
  it('seek bar cannot be moved until the length is known', () => {
    render(<SeekBar positionSec={0} durationSec={0} disabled={false} />);
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeDisabled();
    expect(screen.getByText('--:--')).toBeInTheDocument();
  });

  it('shows elapsed and total time once the length is known', () => {
    render(<SeekBar positionSec={65} durationSec={213} disabled={false} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('3:33')).toBeInTheDocument();
  });

  it('volume is this person only: changing it stores it on this device', () => {
    render(<VolumeControl value={80} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '35' } });
    expect(useRoomStore.getState().volume).toBe(35);
    expect(localStorage.getItem('jam_volume')).toBe('35');
  });
});

describe('chat panel', () => {
  it('shows an empty state and groups consecutive lines from one person', () => {
    useRoomStore.setState({
      roomId: 'r1',
      userId: 'me-user',
      members: [{ user_id: 'bo', name: 'Bo', avatar: null, joined_at: new Date().toISOString(), is_kicked: false }],
      messages: [
        { id: '1', room_id: 'r1', user_id: 'bo', name: 'Bo', kind: 'user', text: 'one', created_at: new Date().toISOString() },
        { id: '2', room_id: 'r1', user_id: 'bo', name: 'Bo', kind: 'user', text: 'two', created_at: new Date().toISOString() },
      ],
    });
    const { container } = render(<ChatPanel />);
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(container.querySelectorAll('.msg.grouped')).toHaveLength(1);
  });

  it('empty chat says what it is for', () => {
    render(<ChatPanel />);
    expect(screen.getByText('Say something. Everyone in the room sees it.')).toBeInTheDocument();
  });
});

describe('link parsing for the add bar', () => {
  it('splits a multi-line paste into ids and junk', () => {
    const r = parseVideoLinks('dQw4w9WgXcQ\nnot a link');
    expect(r.ids).toEqual(['dQw4w9WgXcQ']);
    expect(r.invalid).toEqual(['not', 'a', 'link']);
  });
});

describe('toasts', () => {
  it('shows a message and removes it after its timeout', () => {
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
