// « Comment ça marche » under the flood simulator: the rules of a flood (docs/research/combat.md) and how the plan
// spreads the attacks, with an example computed by `planFlood`. Server component.
import { FLOOD_MARGIN, planFlood } from "@optizzz/game/flood";
import { formatNumber } from "@optizzz/game/format/number-format";
import { HelpSection, ToolHelp } from "~/components/tools/tool-help";

const HEADINGS = [
  { id: "regles", title: "Les règles d'une attaque" },
  { id: "plan", title: "Comment le plan répartit les attaques" },
  { id: "exemple", title: "Un exemple" },
  { id: "suppose", title: "Ce qui est supposé" },
] as const;

/** Two players of 300 000 cm², Vitesse d'attaque 4 (five attacks), enough ants for any take. */
const FIELD = 300_000;
const SLOTS = 5;

export function FloodHelp() {
  const waves = planFlood({
    attackerField: FIELD,
    targetField: FIELD,
    slots: SLOTS,
    ants: Number.MAX_SAFE_INTEGER,
    margin: FLOOD_MARGIN,
  });
  const total = waves.reduce((sum, wave) => sum + wave.take, 0);
  const [rulesHeading, planHeading, exampleHeading, assumedHeading] = HEADINGS;
  return (
    <ToolHelp
      headings={HEADINGS}
      guideId="flood"
      intro="Les règles d'une suite d'attaques sur le même TDC, et la façon dont le simulateur les enchaîne pour prendre le plus."
    >
      <HelpSection heading={rulesHeading} index={1} certainty="checked" detail="aide du jeu, 8 oct. 2026">
        <ul>
          <li>
            <strong>Portée</strong> : on n&apos;attaque qu&apos;un joueur dont le TDC est entre 50 % (inclus) et 300 %
            (exclu) du sien.
          </li>
          <li>
            <strong>Prise</strong> : une attaque gagnée prend 20 % du TDC de la cible, arrondi en dessous, et pas plus
            d&apos;1 cm² par fourmi.
          </li>
          <li>
            <strong>Attaques à la fois</strong> : Vitesse d&apos;attaque + 1, moins vos attaques déjà en route.
          </li>
        </ul>
      </HelpSection>

      <HelpSection heading={planHeading} index={2}>
        <p>
          Chaque attaque fait grandir votre TDC et rapetisser celui de la cible : après quelques prises, la cible passe
          sous la moitié du vôtre et sort de portée. Le simulateur prend donc 20 % tant que la cible reste attaquable
          ensuite. Quand une prise pleine la ferait sortir trop tôt, il prend juste ce qu&apos;il faut pour la garder à
          la limite, puis finit par une dernière attaque à 20 %.
        </p>
        <p>
          Chaque attaque garde une marge d&apos;1 % au-dessus des 50 % : d&apos;autres attaques ou chasses peuvent
          bouger les deux TDC avant l&apos;arrivée.
        </p>
      </HelpSection>

      <HelpSection heading={exampleHeading} index={3}>
        <p>Deux joueurs à {formatNumber(FIELD)} cm², Vitesse d&apos;attaque 4, assez de fourmis pour chaque prise :</p>
        <figure className="overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">Les attaques du plan, leur prise et les TDC après chacune</caption>
              <thead>
                <tr className="bg-raised">
                  <th scope="col" className="px-3 py-2 text-left">
                    N°
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Prise
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Son TDC après
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Mon TDC après
                  </th>
                </tr>
              </thead>
              <tbody>
                {waves.map((wave, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-1.5">{index + 1}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{formatNumber(wave.take)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(wave.targetAfter)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(wave.attackerAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
            {formatNumber(total)} cm² en {waves.length} attaques. Calculé par Optizzz avec les règles ci-dessus.
          </figcaption>
        </figure>
        <p>
          La deuxième attaque prend moins que 20 % : une prise pleine aurait mis la cible hors de portée de la
          troisième. Trois attaques suffisent, même avec cinq possibles : une quatrième n&apos;aurait plus de cible à
          portée.
        </p>
      </HelpSection>

      <HelpSection heading={assumedHeading} index={4} certainty="unchecked">
        <ul>
          <li>La limite d&apos;1 cm² par fourmi compte-t-elle les fourmis envoyées ou les survivantes ?</li>
          <li>La portée revérifiée à l&apos;arrivée de chaque attaque, et la marge d&apos;1 % : une précaution.</li>
          <li>Sans défense collée, le plan suppose que chaque attaque gagne.</li>
        </ul>
      </HelpSection>
    </ToolHelp>
  );
}
