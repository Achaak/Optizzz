// An alliance's probable floods over 7 days, by other alliance (docs/features/analyse-alliances.md).
import type { AllianceFloods } from "@optizzz/game/analysis/alliance-floods";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import Link from "next/link";
import { Panel } from "~/components/panel";

const balance = (taken: number, lost: number) => {
  const value = taken - lost;
  return value === 0 ? "0" : `${value > 0 ? "▲ +" : "▼ −"}${formatCompact(Math.abs(value))}`;
};

export function AllianceFloodsPanel({ server, floods }: { server: string; floods: AllianceFloods }) {
  const cell = "px-2 py-1.5 text-right tabular-nums";
  return (
    <Panel flush title="Floods probables sur 7 j">
      {floods.rows.length === 0 && floods.unknown.count === 0 && floods.inside.count === 0 ? (
        <p className="px-4.5 pb-4 text-sm text-muted-foreground">Aucun flood probable relevé sur 7 jours.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="px-4.5 py-2 text-left font-medium">
                  Alliance adverse
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Pris
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Perdu
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Solde
                </th>
                <th scope="col" className="px-4.5 py-2 text-right font-medium">
                  Floods
                </th>
              </tr>
            </thead>
            <tbody>
              {floods.rows.map((row) => (
                <tr key={row.opponent} className="border-t border-border">
                  <td className="px-4.5 py-1.5 font-semibold">
                    {row.kind === "alliance" ? (
                      <Link
                        href={`/${server}/alliances/${encodeURIComponent(row.opponent)}`}
                        className="hover:underline"
                      >
                        {row.opponent}
                      </Link>
                    ) : (
                      row.opponent
                    )}
                  </td>
                  <td className={cell}>{formatCompact(row.taken)}</td>
                  <td className={cell}>{formatCompact(row.lost)}</td>
                  <td className={`${cell} font-semibold`}>{balance(row.taken, row.lost)}</td>
                  <td className="px-4.5 py-1.5 text-right tabular-nums">{formatNumber(row.count)}</td>
                </tr>
              ))}
              {floods.unknown.count > 0 && (
                <tr className="border-t border-border text-muted-foreground">
                  <td className="px-4.5 py-1.5">inconnu</td>
                  <td className={cell}>{formatCompact(floods.unknown.taken)}</td>
                  <td className={cell}>{formatCompact(floods.unknown.lost)}</td>
                  <td className={cell}>{balance(floods.unknown.taken, floods.unknown.lost)}</td>
                  <td className="px-4.5 py-1.5 text-right tabular-nums">{formatNumber(floods.unknown.count)}</td>
                </tr>
              )}
              {floods.inside.count > 0 && (
                <tr className="border-t-2 border-border text-muted-foreground">
                  <td className="px-4.5 py-1.5">Dans l&apos;alliance (chaîne de TDC)</td>
                  <td className={cell}>{formatCompact(floods.inside.amount)}</td>
                  <td className={cell}>{formatCompact(floods.inside.amount)}</td>
                  <td className={cell}>—</td>
                  <td className="px-4.5 py-1.5 text-right tabular-nums">{formatNumber(floods.inside.count)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4.5 pt-2 pb-4 text-xs text-muted-foreground">
        Les floods sans alliance adverse sûre comptent dans « inconnu ». Calculé d&apos;après l&apos;export public de
        Fourmizzz, relevé chaque heure.
      </p>
    </Panel>
  );
}
