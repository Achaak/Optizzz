import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

/** One figure with its label: « 1 857 · joueurs ». */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** « Relevé du 22/10 à 16 h 03 » under a page title, or why there is nothing yet. */
export function ReadingNote({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
