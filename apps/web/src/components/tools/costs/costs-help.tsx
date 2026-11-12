// « Comment ça marche » under the costs tool: how a level's cost and time grow, and the bonuses
// (docs/research/couts-des-niveaux.md), with examples computed by `levelCost`. Server component.
import { formatNumber } from "@optizzz/game/format/number-format";
import { levelCost } from "@optizzz/game/level-costs";
import { Formula, HelpSection, spelledDuration, ToolHelp } from "~/components/tools/tool-help";

const HEADINGS = [
  { id: "cout", title: "Le coût d'un niveau" },
  { id: "duree", title: "La durée d'un niveau" },
  { id: "bonus", title: "Architecture et Salle d'analyse" },
  { id: "ressources", title: "Ce que coûte quoi" },
] as const;

/** Architecture 10, as on the S5 account the bonuses were measured on (2026-10-23). */
const ARCHITECTURE = 10;

export function CostsHelp() {
  const mushroom9 = levelCost("mushroom", 9);
  const mushroom10 = levelCost("mushroom", 10);
  const weapons10 = levelCost("weapons", 10);
  const withBonus = Math.round(mushroom9.seconds * 0.9 ** ARCHITECTURE);
  const [costHeading, timeHeading, bonusHeading, resourcesHeading] = HEADINGS;
  return (
    <ToolHelp
      headings={HEADINGS}
      intro="Comment le prix et la durée d'un bâtiment ou d'une recherche grandissent d'un niveau à l'autre, et ce que changent vos bonus."
    >
      <HelpSection heading={costHeading} index={1} certainty="checked" detail="jeu, 23 oct. 2026">
        <p>
          Chaque niveau coûte <strong>deux fois</strong> le précédent. Seule la Champignonnière grandit moins vite, ×
          1,85 par niveau, et le jeu coupe alors les décimales.
        </p>
        <Formula>{`coût du niveau N = coût du niveau 1 × 2 ^ (N − 1)
Champignonnière  = ⌊90 × 1,85 ^ (N − 1)⌋ matériaux`}</Formula>
        <p className="text-sm text-muted-foreground">
          Exemple : la Champignonnière 9 coûte {formatNumber(mushroom9.cost.materials)} matériaux, comme dans le jeu ;
          la 10, {formatNumber(mushroom10.cost.materials)}. Doubler à chaque niveau fait vite grimper la facture : le
          niveau 10 d&apos;une recherche coûte 512 fois son niveau 1.
        </p>
      </HelpSection>

      <HelpSection heading={timeHeading} index={2} certainty="players">
        <p>
          La durée d&apos;un niveau est celle du précédent × <strong>1,6</strong> pour un bâtiment, ×{" "}
          <strong>1,7</strong> pour une recherche. Passé certains niveaux, propres à chaque bâtiment et recherche, la
          croissance ralentit : × 1,3, puis × 1,2, puis × 1,12. Ces paliers viennent de tables tenues par des joueurs ;
          elles collent à toutes les durées que le jeu nous a montrées.
        </p>
      </HelpSection>

      <HelpSection heading={bonusHeading} index={3} certainty="checked" detail="jeu, 23 oct. 2026">
        <p>
          Chaque niveau d&apos;<strong>Architecture</strong> retire 10 % de la durée des bâtiments, chaque niveau de{" "}
          <strong>Salle d&apos;analyse</strong> 10 % de celle des recherches. Le jeu applique le bonus à la durée
          exacte, puis arrondit à la seconde. Le coût, lui, ne change pas.
        </p>
        <Formula>{"durée affichée = arrondi(durée sans bonus × 0,9 ^ niveau du bonus)"}</Formula>
        <p className="text-sm text-muted-foreground">
          Exemple : la Champignonnière 9 dure {spelledDuration(mushroom9.seconds)} sans bonus, et{" "}
          {spelledDuration(withBonus)} avec l&apos;Architecture {ARCHITECTURE}.
        </p>
      </HelpSection>

      <HelpSection heading={resourcesHeading} index={4} certainty="checked" detail="jeu, 23 oct. 2026">
        <ul>
          <li>Un bâtiment ne coûte que des matériaux.</li>
          <li>
            Une recherche coûte de la nourriture, des matériaux et, pour la plupart, des ouvrières : l&apos;Armes 10
            demande {formatNumber(weapons10.cost.food)} de nourriture, {formatNumber(weapons10.cost.materials)}{" "}
            matériaux et {formatNumber(weapons10.cost.workers)} ouvrières.
          </li>
          <li>
            L&apos;outil additionne les niveaux demandés : passer de 5 à 10, c&apos;est payer les niveaux 6 à 10, pas
            seulement le 10.
          </li>
        </ul>
      </HelpSection>
    </ToolHelp>
  );
}
