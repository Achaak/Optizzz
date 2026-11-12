// « Comment ça marche » under the hunt simulator: the rules its engine follows (docs/research/chasse.md), with an example
// computed by the same functions. Server component.
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { difficulty, foodTarget, huntDurationSeconds } from "@optizzz/game/hunt/difficulty";
import { Formula, HelpSection, ToolHelp } from "~/components/tools/tool-help";

const HEADINGS = [
  { id: "difficulte", title: "La difficulté" },
  { id: "duree", title: "La durée" },
  { id: "combat", title: "Le combat et les pertes" },
  { id: "zero-perte", title: "Pourquoi pas « zéro perte »" },
  { id: "une-ou-plusieurs", title: "Une chasse ou plusieurs" },
] as const;

/** The example: a hunt of 136 cm² at 4 496 cm², Vitesse de chasse 3, as in a report of 7 October 2026. */
const FIELD = 4_496;
const AMOUNT = 136;
const HUNT_SPEED = 3;

/**
 * cm² per hour with no losses against 1 % of losses, measured with the engine (Armes = Bouclier = 4, Vitesse de
 * chasse 3, 4 slots) for docs/research/chasse.md, « Ce que ça change pour le joueur ». Too slow to plan on each render.
 */
const NO_LOSS = [
  { army: "2 112 JSN et 146 SN", none: 0, onePercent: 184 },
  { army: "3 000 Tueuses", none: 87, onePercent: 2_789 },
  { army: "20 000 JSN et 2 000 Tanks", none: 0, onePercent: 3_605 },
] as const;

export function HuntHelp() {
  const fixed = FIELD * 0.01;
  const hard = difficulty(FIELD, AMOUNT);
  const step = hard / ((AMOUNT + fixed) * 3);
  const seconds = huntDurationSeconds(FIELD, AMOUNT, HUNT_SPEED);
  const [difficultyHeading, durationHeading, combatHeading, noLossHeading, howManyHeading] = HEADINGS;
  return (
    <ToolHelp
      headings={HEADINGS}
      guideId="hunt"
      intro="Les règles que suit le simulateur, avec un exemple chiffré. Ce qui n'est pas encore vérifié dans le jeu est dit comme tel."
    >
      <HelpSection heading={difficultyHeading} index={1} certainty="checked" detail="rapport du 7 oct. 2026">
        <p>
          Une chasse de <em>s</em> cm² met en face de votre armée des proies qui dépendent de la surface visée et de
          votre Terrain de Chasse <strong>au moment du combat</strong>, pas au lancement. Plus votre TDC est grand, plus
          chaque cm² est défendu : la difficulté monte de 4 % chaque fois que le TDC grandit d&apos;environ 26 %.
        </p>
        <Formula>{`palier     = 1,04 ^ arrondi(10 × log10(TDC / 50))
difficulté = (s + 1 % du TDC) × palier × 3`}</Formula>
        <p className="text-sm text-muted-foreground">
          Exemple : {formatNumber(AMOUNT)} cm² à {formatNumber(FIELD)} cm² de TDC. Le palier vaut{" "}
          {formatDecimal(step, 2)}, la difficulté ({formatNumber(AMOUNT)} + {formatNumber(Math.round(fixed))}) ×{" "}
          {formatDecimal(step, 2)} × 3 ≈ {formatNumber(Math.round(hard))}. Les carcasses rapportent 80 % de la
          difficulté, environ {formatNumber(Math.round(foodTarget(FIELD, AMOUNT)))} de nourriture.
        </p>
      </HelpSection>

      <HelpSection heading={durationHeading} index={2}>
        <Formula>{"secondes = (TDC au lancement + s) × 0,9 ^ Vitesse de chasse"}</Formula>
        <p>
          Avec la Vitesse de chasse {HUNT_SPEED}, la chasse de l&apos;exemple dure{" "}
          <strong>
            {Math.floor(seconds / 60)} min {String(seconds % 60).padStart(2, "0")} s
          </strong>
          . Vous pouvez avoir <strong>Vitesse de chasse + 1</strong> chasses en route en même temps. Lancées ensemble,
          elles ont la même durée, reviennent dans l&apos;ordre du lancement, et chacune combat au TDC laissé par les
          précédentes.
        </p>
      </HelpSection>

      <HelpSection heading={combatHeading} index={3} certainty="checked" detail="35 rapports, oct. 2026">
        <ul>
          <li>
            Chaque tour, les deux camps frappent en même temps. Armes ajoute 10 % d&apos;attaque par niveau, Bouclier 10
            % de vie.
          </li>
          <li>Vos unités encaissent dans l&apos;ordre de la ponte : les Jeunes Soldates Naines d&apos;abord.</li>
          <li>
            Si votre attaque dépasse 1,5, 2 ou 3 fois la vie des proies, leur premier coup ne fait que 50, 30 ou 10 % de
            ses dégâts.
          </li>
          <li>Une défaite coûte toute l&apos;armée envoyée.</li>
        </ul>
        <p className="rounded-xl border-2 border-dashed border-primary px-3.5 py-3 text-sm">
          <strong>D&apos;après les joueurs</strong> : une unité qui a perdu plus de la moitié de sa vie ne rentre pas,
          même quand le rapport n&apos;en compte aucune de tuée. Le simulateur compte les pertes ainsi, et affiche aussi
          le chiffre du rapport.
        </p>
      </HelpSection>

      <HelpSection heading={noLossHeading} index={4}>
        <p>
          Le terme fixe de la difficulté, 1 % du TDC, attire des proies qui blessent toujours quelques unités, même pour
          1 cm². Accepter un peu de pertes rapporte bien plus :
        </p>
        <figure className="overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">cm² gagnés par heure selon les pertes acceptées</caption>
              <thead>
                <tr className="bg-raised">
                  <th scope="col" className="px-3 py-2 text-left">
                    Armée, à {formatNumber(FIELD)} cm² de TDC
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Zéro perte
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    1 % de pertes
                  </th>
                </tr>
              </thead>
              <tbody>
                {NO_LOSS.map((row) => (
                  <tr key={row.army} className="border-t">
                    <td className="px-3 py-2">{row.army}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.none)} cm²/h</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatNumber(row.onePercent)} cm²/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
            Calculé par Optizzz : Armes et Bouclier 4, Vitesse de chasse 3.
          </figcaption>
        </figure>
      </HelpSection>

      <HelpSection heading={howManyHeading} index={5}>
        <p>
          Chaque chasse paie le même terme fixe. Pour une même surface en tout, une grosse chasse est donc souvent plus
          sûre que plusieurs petites. Le simulateur essaie chaque nombre de chasses, de 1 à Vitesse de chasse + 1, et
          garde celui qui rapporte le plus de cm² par heure.
        </p>
      </HelpSection>
    </ToolHelp>
  );
}
