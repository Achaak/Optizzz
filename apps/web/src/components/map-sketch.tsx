// A server's map as a sketch: its biggest players as dots, the ten first in the accent. Decoration behind a page's
// top: each axis is stretched to the frame (a server is a long strip, S1 runs 48 wide and 2 854 tall), so distances
// are not to scale; the real map, with axes of the same scale, is on « Carte ».

const WIDTH = 600;
const HEIGHT = 400;
const MARGIN = 16;

/** `nests` from the biggest TDC down (`mapSketch`): the first ten stand out, the rest fade with their rank. */
export function MapSketch({ nests, className }: { nests: { x: number; y: number }[]; className?: string }) {
  if (nests.length === 0) return null;
  const xs = nests.map((nest) => nest.x);
  const ys = nests.map((nest) => nest.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scaleX = (WIDTH - 2 * MARGIN) / (maxX - minX || 1);
  const scaleY = (HEIGHT - 2 * MARGIN) / (maxY - minY || 1);
  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className}
    >
      {[...nests].reverse().map((nest, index) => {
        const rank = nests.length - index;
        const cx = Math.round(MARGIN + (nest.x - minX) * scaleX);
        const cy = Math.round(MARGIN + (nest.y - minY) * scaleY);
        return rank <= 10 ? (
          <circle key={`${String(cx)}-${String(cy)}-${String(rank)}`} cx={cx} cy={cy} r={3.6} fill="var(--primary)" />
        ) : (
          <circle
            key={`${String(cx)}-${String(cy)}-${String(rank)}`}
            cx={cx}
            cy={cy}
            r={rank <= 100 ? 2.6 : rank <= 300 ? 1.8 : 1.3}
            fill="var(--dot)"
          />
        );
      })}
    </svg>
  );
}
