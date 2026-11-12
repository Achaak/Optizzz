// The « Le combat » guide (docs/features/site-guides.md): range, units, blows, the three places, an example fight,
// what a victory takes, defending, the « Combat » score. Rules: docs/research/combat.md and
// ressources-et-entretien.md; the example fight is computed by the battle engine of @optizzz/game.
import { battle, type Place } from "@optizzz/game/army/battle";
import { armyFromKeys, emptyArmy, UNITS } from "@optizzz/game/army/units";
import { formatNumber } from "@optizzz/game/format/number-format";
import { siteToolPath } from "@optizzz/game/site-links/site";
import type { Metadata } from "next";
import Link from "next/link";
import { CertaintyMark, GuidePage, GuideSection, Rule, type GuideHeading } from "~/components/guides/guide-parts";
import { SmallLabel } from "~/components/panel";
import { guide, guidePath } from "~/lib/guides/guides";

const entry = guide("combat");

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: guidePath(entry.id) },
};

const HEADINGS = [
  { id: "pourquoi", title: "Pourquoi attaquer, et qui" },
  { id: "unites", title: "Les unités" },
  { id: "coups", title: "Les coups" },
  { id: "lieux", title: "Les trois lieux" },
  { id: "exemple", title: "Un combat, pas à pas" },
  { id: "gains", title: "Ce que rapporte une victoire" },
  { id: "defendre", title: "Se défendre" },
  { id: "score", title: "Le score « Combat »" },
  { id: "optizzz", title: "Avec Optizzz" },
  { id: "non-verifie", title: "Ce qui n'est pas vérifié" },
] as const satisfies readonly GuideHeading[];

/** Read on Reine.php; the elite Doorkeeper and Tank are not there (docs/research/combat.md). */
const NOT_ON_QUEEN = new Set(["CE", "TkE"]);

const PLACE_NAMES: Record<Place, string> = { field: "Terrain de Chasse", nest: "Fourmilière", lodge: "Loge" };

/** The example: 1 000 Tueuses against a nest with Soldates Naines on its field and Soldates inside. */
const EXAMPLE = {
  attacker: { army: armyFromKeys({ Tu: 1_000 }), weapons: 5, shield: 5 },
  defender: {
    armies: { field: armyFromKeys({ SN: 3_000 }), nest: armyFromKeys({ S: 1_500 }), lodge: emptyArmy() },
    weapons: 3,
    shield: 3,
    dome: 5,
    lodge: 0,
  },
} as const;

const sum = (counts: readonly number[]) => counts.reduce((total, count) => total + count, 0);

function UnitsTable() {
  return (
    <figure className="m-0 overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">
            Vie, attaque, défense et nourriture de chaque unité, et ce que donnent 1 000 de nourriture pondus
          </caption>
          <thead>
            <tr className="bg-raised text-right">
              <th scope="col" className="px-3 py-2 text-left">
                Unité
              </th>
              <th scope="col" className="px-3 py-2">
                Vie
              </th>
              <th scope="col" className="px-3 py-2">
                Attaque
              </th>
              <th scope="col" className="px-3 py-2">
                Défense
              </th>
              <th scope="col" className="px-3 py-2">
                Nourriture
              </th>
              <th scope="col" className="px-3 py-2">
                Attaque pour 1 000
              </th>
              <th scope="col" className="px-3 py-2">
                Défense pour 1 000
              </th>
            </tr>
          </thead>
          <tbody className="text-right">
            {UNITS.map((unit) => (
              <tr key={unit.key} className="border-t">
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  {unit.name}
                  {NOT_ON_QUEEN.has(unit.key) && " *"}
                </th>
                <td className="px-3 py-1.5">{formatNumber(unit.hp)}</td>
                <td className="px-3 py-1.5">{formatNumber(unit.attack)}</td>
                <td className="px-3 py-1.5">{formatNumber(unit.defense)}</td>
                <td className="px-3 py-1.5">{formatNumber(unit.food)}</td>
                <td className="px-3 py-1.5">{formatNumber(Math.round((unit.attack * 1000) / unit.food))}</td>
                <td className="px-3 py-1.5">{formatNumber(Math.round((unit.defense * 1000) / unit.food))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
        « Pour 1 000 » : l&apos;attaque ou la défense que donnent 1 000 de nourriture pondus en cette unité, sans bonus.
        * Absente de la page Reine : chiffres d&apos;après les joueurs.
      </figcaption>
    </figure>
  );
}

function ExampleFight() {
  const result = battle(EXAMPLE.attacker, EXAMPLE.defender, "nest");
  const sent = sum(EXAMPLE.attacker.army);
  const [fieldStage, nestStage] = result.stages;
  const percent = (share: number | undefined) => `${formatNumber(Math.round((share ?? 1) * 100))} %`;
  return (
    <>
      <p>
        {formatNumber(sent)} Tueuses, Armes et Bouclier 5, attaquent une Fourmilière. Le défenseur a{" "}
        {formatNumber(sum(EXAMPLE.defender.armies.field))} Soldates Naines sur son TDC,{" "}
        {formatNumber(sum(EXAMPLE.defender.armies.nest))} Soldates dans sa Fourmilière, Armes et Bouclier 3, Dôme{" "}
        {EXAMPLE.defender.dome}. L&apos;attaque passe d&apos;abord par le TDC :
      </p>
      <figure className="m-0 overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">Le combat lieu par lieu</caption>
            <thead>
              <tr className="bg-raised text-right">
                <th scope="col" className="px-3 py-2 text-left">
                  Lieu
                </th>
                <th scope="col" className="px-3 py-2 text-left">
                  Issue
                </th>
                <th scope="col" className="px-3 py-2">
                  Riposte au 1ᵉʳ coup
                </th>
                <th scope="col" className="px-3 py-2">
                  Tueuses perdues
                </th>
                <th scope="col" className="px-3 py-2">
                  Défenseurs tués
                </th>
              </tr>
            </thead>
            <tbody className="text-right">
              {result.stages.map((stage) => (
                <tr key={stage.place} className="border-t">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {PLACE_NAMES[stage.place]}
                  </th>
                  <td className="px-3 py-1.5 text-left font-semibold">{stage.won ? "Gagné" : "Perdu"}</td>
                  <td className="px-3 py-1.5">{formatNumber(Math.round(stage.reply * 100))} %</td>
                  <td className="px-3 py-1.5">{formatNumber(sum(stage.attackerLost))}</td>
                  <td className="px-3 py-1.5">{formatNumber(sum(stage.defenderLost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
          Calculé par Optizzz avec les règles ci-dessus.{" "}
          {result.won
            ? `${formatNumber(sum(result.survivors))} Tueuses sur ${formatNumber(sent)} rentrent.`
            : "L'attaque échoue : toute l'armée envoyée est perdue."}
        </figcaption>
      </figure>
      <p>
        Sur le TDC, le premier coup des Tueuses dépasse 1,5 fois la vie des Soldates Naines : leur riposte tombe à{" "}
        {percent(fieldStage?.reply)}. Dans la Fourmilière, les Soldates ont{" "}
        {formatNumber(Math.round((0.1 + 0.05 * EXAMPLE.defender.dome) * 100))} % de vie en plus grâce au Dôme, face à
        des Tueuses déjà moins nombreuses : leur riposte est de {percent(nestStage?.reply)}, et c&apos;est là que tombe
        l&apos;essentiel des pertes.
      </p>
    </>
  );
}

export default function CombatGuidePage() {
  const tank = UNITS.find((unit) => unit.key === "Tk");
  const gunner = UNITS.find((unit) => unit.key === "A");
  return (
    <GuidePage id={entry.id} headings={HEADINGS}>
      <GuideSection heading={HEADINGS[0]} index={1}>
        <p>Attaquer un autre joueur rapporte, si l&apos;attaque gagne, selon le lieu visé :</p>
        <ul>
          <li>
            du <strong>Terrain de Chasse</strong> (TDC), pris au défenseur ;
          </li>
          <li>
            des <strong>ressources</strong>, en attaquant sa Fourmilière ;
          </li>
          <li>
            sa <strong>colonie</strong>, en attaquant sa Loge : il vous reverse alors une part de sa récolte.
          </li>
        </ul>
        <Rule certainty="checked" detail="aide du jeu">
          <strong>Portée</strong> : on n&apos;attaque qu&apos;un joueur dont le TDC est entre <strong>50 %</strong>{" "}
          (inclus) et <strong>300 %</strong> (exclu) du sien. Avec 100 000 cm², vous pouvez attaquer de 50 000 à 299 999
          cm².
        </Rule>
        <Rule certainty="checked" detail="8 oct. 2026">
          <strong>Attaques à la fois</strong> : Vitesse d&apos;attaque + 1, moins vos attaques déjà en route. La Vitesse
          d&apos;attaque raccourcit aussi le trajet de 10 % par niveau.
        </Rule>
      </GuideSection>

      <GuideSection heading={HEADINGS[1]} index={2}>
        <p>
          Chaque unité a une <strong>vie</strong>, une <strong>attaque</strong>, qui sert quand vous attaquez, et une{" "}
          <strong>défense</strong>, qui sert quand on vous attaque. Rapportées à la nourriture qu&apos;elles coûtent,
          elles ne se valent pas : certaines sont faites pour attaquer, d&apos;autres pour tenir.
        </p>
        <UnitsTable />
        {tank && gunner && (
          <p>
            Le Tank frappe fort ({formatNumber(tank.attack)}) mais ne défend presque rien ({formatNumber(tank.defense)})
            : une unité d&apos;attaque. Les Artilleuses, simples ou d&apos;élite, donnent de loin la meilleure attaque
            pour le prix ({formatNumber(Math.round((gunner.attack * 1000) / gunner.food))} pour 1 000 de nourriture),
            avec peu de vie. Les Concierges, à l&apos;inverse, n&apos;attaquent pas : beaucoup de vie, pour défendre.
          </p>
        )}
      </GuideSection>

      <GuideSection heading={HEADINGS[2]} index={3}>
        <Rule certainty="checked" detail="aide du jeu">
          <ul>
            <li>Les deux camps frappent en même temps.</li>
            <li>
              <strong>Armes</strong> ajoute 10 % de dégâts par niveau, en attaque comme en défense ;{" "}
              <strong>Bouclier</strong> ajoute 10 % de vie par niveau.
            </li>
            <li>Les plus faibles meurent en premier, dans l&apos;ordre de la ponte.</li>
          </ul>
        </Rule>
        <Rule certainty="checked" detail="aide du jeu">
          <strong>Surpuissance</strong> : si votre premier coup dépasse 1,5, 2 ou 3 fois la vie totale des défenseurs,
          leur riposte ne fait que 50, 30 ou 10 % de ses dégâts. C&apos;est le levier principal : une attaque écrasante
          perd très peu.
        </Rule>
        <Rule certainty="checked" detail="rapports du 19 oct. 2026">
          Le bonus d&apos;Armes se lit dans les rapports : 19 221 de dégâts de base deviennent « + 9 611 » à Armes 5.
        </Rule>
      </GuideSection>

      <GuideSection heading={HEADINGS[3]} index={4}>
        <Rule certainty="checked" detail="aide du jeu">
          Une fourmilière se défend en trois lieux, dans cet ordre : le <strong>TDC</strong>, la{" "}
          <strong>Fourmilière</strong>, la <strong>Loge</strong>. Attaquer la Fourmilière, c&apos;est d&apos;abord
          gagner sur le TDC ; attaquer la Loge, gagner sur le TDC puis dans la Fourmilière. Les survivants passent
          d&apos;un lieu au suivant.
        </Rule>
        <Rule certainty="players">
          Le défenseur gagne de la <strong>vie</strong> selon le lieu, en plus de son Bouclier : rien sur le TDC, 10 % +
          5 % par niveau de Dôme dans la Fourmilière, 30 % + 15 % par niveau de Loge dans la Loge. L&apos;aide du jeu
          parle d&apos;un bonus « de défense ».
        </Rule>
      </GuideSection>

      <GuideSection heading={HEADINGS[4]} index={5}>
        <ExampleFight />
      </GuideSection>

      <GuideSection heading={HEADINGS[5]} index={6}>
        <Rule certainty="checked" detail="aide du jeu">
          <ul>
            <li>
              <strong>TDC</strong> : 20 % du TDC du défenseur, 1 cm² par fourmi au plus.
            </li>
            <li>
              <strong>Fourmilière</strong> : 30 % de sa nourriture et de ses matériaux, + 1 % par niveau de votre Étable
              à pucerons, 1 ressource par point d&apos;attaque survivant au plus ; plus le TDC, gagné en passant.
            </li>
            <li>
              <strong>Loge</strong> : la colonie.
            </li>
          </ul>
        </Rule>
        <p>
          Une attaque perdue coûte toute l&apos;armée qui a combattu. Sur plusieurs attaques de suite contre le même
          TDC, chaque prise est calculée sur ce qui reste : c&apos;est le principe du flood, que calcule le{" "}
          <Link href={siteToolPath("flood")}>simulateur de flood</Link>.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[6]} index={7}>
        <p>Le combat se joue aussi en défense. Trois choses à savoir pour placer son armée :</p>
        <ul>
          <li>
            Les unités <strong>défendent avec leur défense</strong>, pas leur attaque : une armée de Tanks qui attaque
            bien tient mal chez elle.
          </li>
          <li>
            La <strong>Loge</strong> donne le plus de vie, le TDC aucune. Mais une attaque sur la Fourmilière ou la Loge
            doit d&apos;abord gagner sur le TDC : une garnison sur le TDC protège aussi ce qu&apos;il y a derrière.
          </li>
          <li>
            Chaque jour, une unité mange une part de son coût en nourriture selon l&apos;endroit où elle se trouve : 5 %
            dehors (TDC, chasse, attaque), 10 % dans la Fourmilière, 15 % dans la Loge.
          </li>
        </ul>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <CertaintyMark certainty="checked" detail="Ressources, 7 oct. 2026" />
          <span>La consommation de l&apos;armée, troupes en déplacement comprises.</span>
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[7]} index={8}>
        <p>
          Le classement « Combat » est un score de <strong>trophées</strong>, calculé comme un classement Elo : après un
          gros combat entre deux joueurs, le gagnant prend des points au perdant. Un score de 0 veut dire « pas classé
          », pas « aucun trophée ».
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <CertaintyMark certainty="players" />
          <span>
            Une sonde perdue donnerait aussi des trophées au joueur sondé. La formule exacte, et ce qu&apos;est un «
            gros » combat, ne sont pas connus.
          </span>
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[8]} index={9}>
        <ul className="grid list-none! gap-3 pl-0! sm:grid-cols-2">
          {[
            {
              kicker: "Outil",
              title: "Simulateur de combat",
              text: "Le résultat d'une attaque, lieu par lieu, et la lecture d'un rapport collé pour retrouver les niveaux de l'adversaire.",
              href: siteToolPath("combat"),
            },
            {
              kicker: "Outil",
              title: "Simulateur de flood",
              text: "Plusieurs attaques de suite sur le même TDC, pour prendre le plus.",
              href: siteToolPath("flood"),
            },
          ].map((tool) => (
            <li key={tool.title} className="mt-0!">
              <Link
                href={tool.href}
                className="lift flex h-full flex-col gap-1 rounded-[0.875rem] bg-card p-4 shadow-panel"
              >
                <SmallLabel>{tool.kicker}</SmallLabel>
                <span className="font-heading text-[1.375rem] font-bold uppercase">{tool.title}</span>
                <span className="text-sm text-muted-foreground">{tool.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </GuideSection>

      <GuideSection heading={HEADINGS[9]} index={10}>
        <div className="space-y-2 rounded-xl border-2 border-dotted border-muted-foreground px-4 py-3.5 text-sm">
          <CertaintyMark certainty="unchecked" />
          <ul>
            <li>
              Le combat en plusieurs tours jusqu&apos;à la chute d&apos;un camp : les premiers vrais rapports n&apos;ont
              montré qu&apos;un échange, mais un camp y mourait d&apos;un coup.
            </li>
            <li>La limite d&apos;1 cm² par fourmi : fourmis envoyées ou survivantes ?</li>
            <li>La riposte sur le TDC, dite « plus dure » par des joueurs, sans formule connue.</li>
            <li>Une attaque sur la Loge rapporte-t-elle aussi le TDC et le pillage des lieux traversés ?</li>
            <li>Les promotions après un combat entre joueurs : leur formule n&apos;est pas connue.</li>
          </ul>
          <p>
            Viser 1,5, 2 ou 3 fois la vie des défenseurs ne garantit rien si la vie des défenseurs est mal estimée :
            leurs niveaux ne sont pas publics.
          </p>
        </div>
      </GuideSection>
    </GuidePage>
  );
}
