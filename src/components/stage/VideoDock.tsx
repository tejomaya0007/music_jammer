import type { RefObject } from 'react';

/**
 * The YouTube iframe lives here in every skin and is never display:none (browsers pause hidden
 * frames). Hidden by default under the page; "Show video" fades it in as a small dock.
 */
export function VideoDock({ mountRef, open, onClose }: { mountRef: RefObject<HTMLDivElement | null>; open: boolean; onClose: () => void }) {
  return (
    <div className={`video-dock${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="video-mount" ref={mountRef} />
      {open && (
        <button type="button" className="video-close" aria-label="Hide video" onClick={onClose}>Close</button>
      )}
    </div>
  );
}
