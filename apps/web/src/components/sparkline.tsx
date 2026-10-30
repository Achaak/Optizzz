import { sparklinePath } from "~/lib/sparkline";

const WIDTH = 240;
const HEIGHT = 56;

/** A small curve, filled under it; `label` says it in words for those who do not see it. */
export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
  if (values.length < 2) return null;
  const line = sparklinePath(values, WIDTH, HEIGHT);
  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={className ?? "h-14 w-full"}
    >
      <path d={`${line} L${String(WIDTH)} ${String(HEIGHT)} L0 ${String(HEIGHT)} Z`} className="fill-accent" />
      <path d={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-primary" />
    </svg>
  );
}
