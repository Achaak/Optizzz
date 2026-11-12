// « Comment ça marche » under the travel tool: the travel time formula (docs/research/temps-de-trajet.md), with the
// game's own profile measure as the example, computed by the same function. Server component.
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { distance, travelTime } from "@optizzz/game/travel";
import { Formula, HelpSection, spelledDuration, ToolHelp } from "~/components/tools/tool-help";

const HEADINGS = [
  { id: "formule", title: "La formule" },
  { id: "vitesse-attaque", title: "La Vitesse d'attaque" },
  { id: "distance", title: "La distance" },
  { id: "convois", title: "Les convois" },
] as const;

/** The profile read on 2026-10-08: from (55;28) to (35;8), Vitesse d'attaque 3, the game showed 10H 1m 2s. */
const FROM = { x: 55, y: 28 };
const TO = { x: 35, y: 8 };
const ATTACK_SPEED = 3;
/** Far enough for the exponential to be gone: the ceiling. */
const FAR = 100_000;

export function TravelHelp() {
  const far = distance(FROM, TO);
  const [formulaHeading, speedHeading, distanceHeading, convoyHeading] = HEADINGS;
  return (
    <ToolHelp
      headings={HEADINGS}
      guideId="travel"
      intro="Comment le jeu calcule la durée d'une attaque ou d'un convoi, et où la vérifier. Ce qui n'est pas encore vérifié est dit comme tel."
    >
      <HelpSection heading={formulaHeading} index={1} certainty="checked" detail="profil du 8 oct. 2026">
        <p>
          La durée ne dépend que de la <strong>distance</strong> entre les deux fourmilières et de la{" "}
          <strong>Vitesse d&apos;attaque</strong> de celui qui envoie. Elle grandit vite sur les premières cases, puis
          de moins en moins : sans Vitesse d&apos;attaque, elle ne dépasse jamais {formatNumber(travelTime(FAR, 0))}{" "}
          secondes, environ 7 jours et 9 heures, même à l&apos;autre bout de la carte.
        </p>
        <Formula>{`distance = √((x₁ − x₂)² + (y₁ − y₂)²)
secondes = 0,9 ^ Vitesse d'attaque × 637 200 × (1 − e^(−distance / 350))`}</Formula>
        <p className="text-sm text-muted-foreground">
          Le résultat est arrondi à la seconde inférieure. Exemple : de ({FROM.x};{FROM.y}) à ({TO.x};{TO.y}), la
          distance vaut {formatDecimal(far, 2)} ; avec la Vitesse d&apos;attaque {ATTACK_SPEED}, le trajet dure{" "}
          {spelledDuration(travelTime(far, ATTACK_SPEED))}, à la seconde près ce que le jeu affichait ce jour-là sur le
          profil du joueur.
        </p>
      </HelpSection>

      <HelpSection heading={speedHeading} index={2} certainty="checked" detail="aide du jeu">
        <p>
          Chaque niveau de Vitesse d&apos;attaque retire 10 % du temps qui reste, pour les attaques comme pour les
          convois. Sur le trajet de l&apos;exemple :
        </p>
        <ul>
          {[0, 3, 6, 10].map((level) => (
            <li key={level}>
              Vitesse d&apos;attaque {level} : {spelledDuration(travelTime(far, level))}
            </li>
          ))}
        </ul>
        <p>Elle fixe aussi combien d&apos;attaques peuvent être en route en même temps : Vitesse d&apos;attaque + 1.</p>
      </HelpSection>

      <HelpSection heading={distanceHeading} index={3} certainty="checked" detail="profil du 8 oct. 2026">
        <p>
          Le profil d&apos;un joueur, dans le jeu, affiche la distance et le temps de trajet depuis votre fourmilière,
          avec votre Vitesse d&apos;attaque. La distance y est arrondie à l&apos;entier supérieur (
          {formatDecimal(far, 2)} s&apos;affiche « {formatNumber(Math.ceil(far))} »), mais le temps utilise la distance
          exacte : deux joueurs à la même distance affichée peuvent avoir des trajets différents de quelques minutes.
        </p>
      </HelpSection>

      <HelpSection heading={convoyHeading} index={4} certainty="unchecked">
        <p>
          Un convoi suit la même formule, avec la Vitesse d&apos;attaque de celui qui l&apos;envoie. Un seul convoi
          mesuré a donné quelques minutes de plus que la formule, mais l&apos;heure de départ n&apos;était connue
          qu&apos;à la minute. Le temps de cet outil vaut pour les deux ; pour un convoi, gardez quelques minutes de
          marge.
        </p>
      </HelpSection>
    </ToolHelp>
  );
}
