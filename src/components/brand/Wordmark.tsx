/** Wordmark: "Jam Room" in Fraunces 600, one colour, with a vinyl-notch mark (DESIGN.md 11). */
export function Wordmark({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className={`wordmark ${size}`}>
      <span className="notch" aria-hidden="true">
        <span className="notch-hole" />
      </span>
      <span className="wordmark-text">Jam Room</span>
    </div>
  );
}
