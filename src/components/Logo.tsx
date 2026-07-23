const ACCENT = "#0A84FF";
const CORE = "#BFE0FF";

/**
 * EA NAPTUNE mark — three neon candlesticks.
 * Drawn twice: a blurred halo underneath, a pale core on top, which is what
 * gives the strokes the lit-from-within look of the reference artwork.
 */
export default function Logo({ size = 32 }: { size?: number }) {
  const candles = (stroke: string, width: number) => (
    <g stroke={stroke} strokeWidth={width} fill="none" strokeLinecap="butt">
      {/* left candle */}
      <path d="M19.5 19V53" />
      <rect x="15" y="26" width="9" height="20" />
      {/* middle candle */}
      <path d="M32 4V60" />
      <rect x="27" y="13.5" width="10" height="37" />
      {/* right candle */}
      <path d="M44.5 16V52" />
      <rect x="40" y="23" width="9" height="21.5" />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 ${size / 10}px rgba(10,132,255,0.9))` }}
    >
      {candles(ACCENT, 3.4)}
      {candles(CORE, 1.3)}
    </svg>
  );
}
