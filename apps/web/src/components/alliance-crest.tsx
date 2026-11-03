// An alliance's crest: a small shield of one of five colours, picked from its tag, with the tag's first letter. The
// colours differ in lightness as much as hue (globals.css), and the tag is always written beside it: the crest helps
// the eye find an alliance again in a list, it never says alone which one it is.

const CRESTS = ["bg-crest-1", "bg-crest-2", "bg-crest-3", "bg-crest-4", "bg-crest-5"] as const;

/** The same tag always gets the same colour, whatever the page. */
function crestOf(tag: string): string {
  let hash = 0;
  for (const char of tag.toUpperCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return CRESTS[hash % CRESTS.length] ?? CRESTS[0];
}

/** The first letter or digit of the tag: « -AP- » gives « A ». */
const initialOf = (tag: string) => /[\p{L}\p{N}]/u.exec(tag)?.[0]?.toUpperCase() ?? "?";

export function AllianceCrest({ tag, size = "sm" }: { tag: string; size?: "xs" | "sm" | "lg" }) {
  const shape = {
    xs: "h-4 w-3.5 rounded-[3px_3px_7px_7px/3px_3px_9px_9px] text-[0px]",
    sm: "h-6 w-5.5 rounded-[4px_4px_11px_11px/4px_4px_13px_13px] text-[0.6875rem]",
    lg: "h-14.5 w-13 rounded-[8px_8px_26px_26px/8px_8px_30px_30px] text-[1.625rem]",
  }[size];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center align-middle font-bold text-crest-ink ${shape} ${crestOf(tag)}`}
    >
      {size !== "xs" && initialOf(tag)}
    </span>
  );
}
