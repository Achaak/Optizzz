// A rank at the head of a row: the first three in a round mark that differs by its outline (filled, ringed, dashed),
// the others as a plain number.

const PODIUM = [
  "bg-primary text-primary-foreground",
  "border-2 border-primary",
  "border-2 border-dashed border-primary",
] as const;

export function RankMark({ rank }: { rank: number }) {
  const podium = PODIUM[rank - 1];
  return podium ? (
    <span className={`inline-grid size-6 place-items-center rounded-full text-xs font-bold ${podium}`}>{rank}</span>
  ) : (
    <span className="inline-block w-6 text-center text-muted-foreground">{rank}</span>
  );
}
