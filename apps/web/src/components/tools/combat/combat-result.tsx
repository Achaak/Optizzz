// The result of the combat simulator, recomputed at each change: verdict and loot, then each place fought.
// The same engine as the extension's simulator (@optizzz/game/army/battle-form). See docs/features/site-combat.md.
import { placeHpBonus, requiredAttack, type Place, type Stage } from "@optizzz/game/army/battle";
import { simulate, type SimulatorForm } from "@optizzz/game/army/battle-form";
import { armyAttack, UNITS } from "@optizzz/game/army/units";
import { inRange } from "@optizzz/game/attack";
import { formatNumber } from "@optizzz/game/format/number-format";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

export const PLACE_LABELS: Record<Place, string> = {
  field: "Terrain de chasse",
  nest: "Fourmilière",
  lodge: "Loge Impériale",
};

const replyLabel = (reply: number) => `${formatNumber(reply * 100)} %`;

/** Victory or defeat said in words; the badge's look only follows (never green against red). */
function Outcome({ won }: { won: boolean }) {
  return <Badge variant={won ? "default" : "outline"}>{won ? "Victoire" : "Défaite"}</Badge>;
}

function StageResult({ stage, form }: { stage: Stage; form: SimulatorForm }) {
  const rows = UNITS.map((unit, i) => ({
    unit,
    sent: stage.attackerBefore[i] ?? 0,
    attackerLost: stage.attackerLost[i] ?? 0,
    present: stage.defenderBefore[i] ?? 0,
    defenderLost: stage.defenderLost[i] ?? 0,
  })).filter((row) => row.sent > 0 || row.present > 0);
  const fought = rows.some((row) => row.present > 0);
  const needed = requiredAttack(
    UNITS.map((_, i) => stage.defenderBefore[i] ?? 0),
    form.defender.shield,
    placeHpBonus(stage.place, form.defender),
  );
  const attack = armyAttack(
    UNITS.map((_, i) => stage.attackerBefore[i] ?? 0),
    form.attacker,
  );
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {PLACE_LABELS[stage.place]} <Outcome won={stage.won} />
        </CardTitle>
        {fought && <CardDescription>Riposte à {replyLabel(stage.reply)}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {fought ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unité</TableHead>
                  <TableHead className="text-right">Attaque : envoyées</TableHead>
                  <TableHead className="text-right">perdues</TableHead>
                  <TableHead className="text-right">Défense : présentes</TableHead>
                  <TableHead className="text-right">perdues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.unit.key}>
                    <TableCell>{row.unit.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.sent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.attackerLost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.present)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.defenderLost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              Attaque {formatNumber(attack)} ; pour une riposte à 50 % : plus de {formatNumber(needed.half)}, à 30 % :
              plus de {formatNumber(needed.thirty)}, à 10 % : plus de {formatNumber(needed.ten)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Personne à cet endroit.</p>
        )}
      </CardContent>
    </Card>
  );
}

const hasUnits = (form: SimulatorForm) => Object.values(form.attacker.army).some((count) => (count ?? 0) > 0);

export function CombatResult({ form }: { form: SimulatorForm }) {
  const { attacker, defender, target } = form;
  const outOfRange = attacker.field > 0 && defender.field > 0 && !inRange(attacker.field, defender.field);
  if (!hasUnits(form)) {
    return (
      <>
        <OutOfRange shown={outOfRange} />
        <p className="text-sm text-muted-foreground">Ajoutez des unités à l&apos;attaquant.</p>
      </>
    );
  }
  const { fought, loot } = simulate(form);
  return (
    <>
      <OutOfRange shown={outOfRange} />
      <p className="flex flex-wrap items-center gap-2 text-lg font-medium">
        <Outcome won={fought.won} />
        {fought.won ? "L'attaque réussit" : "L'attaque échoue"}
        {fought.won &&
          (loot.colony
            ? " : la fourmilière devient votre colonie."
            : ` : ${formatNumber(loot.field)} cm²` +
              (target === "nest"
                ? `, ${formatNumber(loot.food)} nourriture et ${formatNumber(loot.materials)} matériaux`
                : "") +
              ".")}
      </p>
      {fought.stages.map((stage) => (
        <StageResult key={stage.place} stage={stage} form={form} />
      ))}
    </>
  );
}

function OutOfRange({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/50 px-3 py-2 text-sm">
      ⚠ Le TDC du défenseur doit être entre 50 % et 300 % de celui de l&apos;attaquant : cette attaque est impossible.
    </p>
  );
}
