// « Comment ça marche » under the combat simulator: the rules of a fight between players and the units
// (docs/research/combat.md), the table read from `UNITS`. Server component.
import { formatNumber } from "@optizzz/game/format/number-format";
import { UNITS } from "@optizzz/game/army/units";
import { HelpSection, ToolHelp } from "~/components/tools/tool-help";

const HEADINGS = [
  { id: "unites", title: "Les unités" },
  { id: "coups", title: "Les coups" },
  { id: "lieux", title: "Les trois lieux" },
  { id: "gains", title: "Ce que rapporte une victoire" },
  { id: "suppose", title: "Ce qui est supposé" },
] as const;

/** Read on Reine.php; the elite Doorkeeper and Tank are not there (docs/research/combat.md). */
const NOT_ON_QUEEN = new Set(["CE", "TkE"]);

export function CombatHelp() {
  const [unitsHeading, blowsHeading, placesHeading, gainsHeading, assumedHeading] = HEADINGS;
  return (
    <ToolHelp
      headings={HEADINGS}
      guideId="combat"
      intro="Les règles d'un combat entre joueurs que suit le simulateur. Ce qui n'est pas encore vérifié sur un vrai rapport est dit comme tel."
    >
      <HelpSection heading={unitsHeading} index={1} certainty="checked" detail="page Reine">
        <p>
          L&apos;attaquant frappe avec l&apos;<strong>attaque</strong> de ses unités, le défenseur avec leur{" "}
          <strong>défense</strong>. Dans un combat, les unités encaissent dans l&apos;ordre de ce tableau : les Jeunes
          Soldates Naines d&apos;abord.
        </p>
        <figure className="overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">Vie, attaque et défense de chaque unité, sans bonus</caption>
              <thead>
                <tr className="bg-raised">
                  <th scope="col" className="px-3 py-2 text-left">
                    Unité
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Vie
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Attaque
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Défense
                  </th>
                </tr>
              </thead>
              <tbody>
                {UNITS.map((unit) => (
                  <tr key={unit.key} className="border-t">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">
                      {unit.name}
                      {NOT_ON_QUEEN.has(unit.key) && " *"}
                    </th>
                    <td className="px-3 py-1.5 text-right">{formatNumber(unit.hp)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(unit.attack)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(unit.defense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
            * Absente de la page Reine : chiffres d&apos;après les joueurs.
          </figcaption>
        </figure>
      </HelpSection>

      <HelpSection heading={blowsHeading} index={2} certainty="checked" detail="aide du jeu">
        <ul>
          <li>Les deux camps frappent en même temps.</li>
          <li>
            <strong>Armes</strong> ajoute 10 % de dégâts par niveau, en attaque comme en défense ;{" "}
            <strong>Bouclier</strong> ajoute 10 % de vie par niveau.
          </li>
          <li>Les plus faibles meurent en premier, dans l&apos;ordre de la ponte.</li>
          <li>
            Si l&apos;attaque dépasse 1,5, 2 ou 3 fois la vie des défenseurs, leur riposte ne fait que 50, 30 ou 10 % de
            ses dégâts.
          </li>
          <li>On n&apos;attaque qu&apos;un joueur dont le TDC est entre 50 % (inclus) et 300 % (exclu) du sien.</li>
        </ul>
      </HelpSection>

      <HelpSection heading={placesHeading} index={3} certainty="checked" detail="aide du jeu">
        <p>
          Une fourmilière se défend en trois lieux. Attaquer la <strong>Fourmilière</strong>, c&apos;est d&apos;abord
          attaquer le <strong>Terrain de Chasse</strong> ; attaquer la <strong>Loge</strong>, c&apos;est passer par le
          TDC, puis la Fourmilière. Les survivants vont d&apos;un lieu au suivant.
        </p>
        <p className="rounded-xl border-2 border-dashed border-primary px-3.5 py-3 text-sm">
          <strong>D&apos;après les joueurs</strong> : le défenseur gagne de la <strong>vie</strong> selon le lieu (rien
          sur le TDC ; 10 % + 5 % par niveau de Dôme dans la Fourmilière ; 30 % + 15 % par niveau de Loge dans la Loge),
          ajoutée à celle du Bouclier. L&apos;aide du jeu parle d&apos;un bonus « de défense ».
        </p>
      </HelpSection>

      <HelpSection heading={gainsHeading} index={4} certainty="checked" detail="aide du jeu">
        <ul>
          <li>
            <strong>Terrain de Chasse</strong> : 20 % du TDC adverse, 1 cm² par fourmi au plus.
          </li>
          <li>
            <strong>Fourmilière</strong> : 30 % de la nourriture et des matériaux, + 1 % par niveau d&apos;Étable à
            pucerons, 1 ressource par point d&apos;attaque survivant au plus, en plus du TDC.
          </li>
          <li>
            <strong>Loge</strong> : la colonie.
          </li>
        </ul>
      </HelpSection>

      <HelpSection heading={assumedHeading} index={5} certainty="unchecked">
        <ul>
          <li>
            Le combat se joue en tours jusqu&apos;à la chute d&apos;un camp, comme à la chasse. Les premiers vrais
            rapports n&apos;ont montré qu&apos;un échange, mais un camp y mourait d&apos;un coup.
          </li>
          <li>Le plafond de TDC compte les fourmis survivantes, pas celles envoyées.</li>
          <li>
            Les promotions après un combat entre joueurs ne sont pas simulées : leur formule n&apos;est pas connue.
          </li>
        </ul>
      </HelpSection>
    </ToolHelp>
  );
}
