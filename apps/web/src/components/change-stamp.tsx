import type { Change } from "@optizzz/game/changes";
import { journalTag } from "~/lib/server-stats";

// A Journal change's kind as a stamp in a field notebook. The word says the kind; the frame (solid, double, dashed)
// and the small sign say it again, so the colour is never alone (ADR 0003).

type Frame = "solid" | "double" | "dashed";

const SIGNS = {
  cross: "m4 4 16 16M20 4 4 20",
  rings: "M14 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M20 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  flag: "M5 21V4M5 4h12l-3 4 3 4H5",
  shield: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  pen: "M4 20h4L19 9l-4-4L4 16z",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v3M12 19v3M2 12h3M19 12h3",
  gap: "M4 12h6M14 12h6",
  open: "M7 12h10M12 7l5 5-5 5",
} as const;

const STAMPS: Record<Change["kind"], { tone: string; frame: Frame; sign: keyof typeof SIGNS; tilt: string }> = {
  war: { tone: "text-info", frame: "solid", sign: "cross", tilt: "-rotate-3" },
  "war-ended": { tone: "text-info", frame: "dashed", sign: "gap", tilt: "rotate-1" },
  alliance: { tone: "text-info", frame: "solid", sign: "shield", tilt: "rotate-2" },
  joined: { tone: "text-info", frame: "solid", sign: "plus", tilt: "-rotate-1" },
  left: { tone: "text-info", frame: "dashed", sign: "minus", tilt: "rotate-1" },
  pact: { tone: "text-primary", frame: "double", sign: "rings", tilt: "rotate-2" },
  "pact-ended": { tone: "text-primary", frame: "dashed", sign: "gap", tilt: "-rotate-1" },
  colonized: { tone: "text-primary", frame: "double", sign: "flag", tilt: "-rotate-2" },
  freed: { tone: "text-primary", frame: "dashed", sign: "open", tilt: "rotate-1" },
  new: { tone: "text-foreground", frame: "solid", sign: "plus", tilt: "rotate-1" },
  gone: { tone: "text-foreground", frame: "dashed", sign: "minus", tilt: "-rotate-1" },
  pseudo: { tone: "text-foreground", frame: "solid", sign: "pen", tilt: "-rotate-2" },
  holiday: { tone: "text-foreground", frame: "solid", sign: "sun", tilt: "rotate-2" },
  banned: { tone: "text-muted-foreground", frame: "dashed", sign: "cross", tilt: "rotate-1" },
  unbanned: { tone: "text-muted-foreground", frame: "dashed", sign: "open", tilt: "-rotate-1" },
};

const FRAMES: Record<Frame, string> = {
  solid: "border-2 border-solid",
  double: "border-[3px] border-double",
  dashed: "border-2 border-dashed",
};

/** « ✕ GUERRE » in a tilted frame: the kind of a Journal line. */
export function ChangeStamp({ change }: { change: Change }) {
  const stamp = STAMPS[change.kind];
  return (
    <span
      className={`inline-flex items-center gap-1 justify-self-start rounded-[3px] border-current px-1.5 font-heading text-[0.8125rem] font-bold tracking-wider whitespace-nowrap uppercase ${FRAMES[stamp.frame]} ${stamp.tone} ${stamp.tilt}`}
    >
      <svg
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={SIGNS[stamp.sign]} />
      </svg>
      {journalTag(change)}
    </span>
  );
}
