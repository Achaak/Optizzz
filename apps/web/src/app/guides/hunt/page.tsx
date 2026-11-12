// The « La chasse » guide (docs/features/site-guides.md): what a hunt brings, its difficulty and duration, the prey, the
// fight, losses and promotions, and how to choose a hunt. Rules: docs/research/chasse.md; figures computed with the
// hunt engine of @optizzz/game.
import { PREYS } from "@optizzz/game/army/prey";
import { UNITS } from "@optizzz/game/army/units";
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { difficulty, foodTarget, huntDurationSeconds } from "@optizzz/game/hunt/difficulty";
import { siteToolPath } from "@optizzz/game/site-links/site";
import type { Metadata } from "next";
import Link from "next/link";
import { CertaintyMark, GuidePage, GuideSection, Rule, type GuideHeading } from "~/components/guides/guide-parts";
import { SmallLabel } from "~/components/panel";
import { spelledDuration } from "~/components/tools/tool-help";
import { guide, guidePath } from "~/lib/guides/guides";

const entry = guide("hunt");

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: guidePath(entry.id) },
};

const HEADINGS = [
  { id: "gain", title: "Ce que rapporte une chasse" },
  { id: "difficulte", title: "La difficulté" },
  { id: "duree", title: "La durée, et plusieurs chasses à la fois" },
  { id: "proies", title: "Les proies" },
  { id: "combat", title: "Le combat" },
  { id: "pertes", title: "Les pertes" },
  { id: "promotions", title: "Les promotions" },
  { id: "choisir", title: "Bien choisir sa chasse" },
  { id: "optizzz", title: "Avec Optizzz" },
  { id: "non-verifie", title: "Ce qui n'est pas vérifié" },
] as const satisfies readonly GuideHeading[];

/** Hunting fields of the difficulty table: a beginner to a large granary. */
const FIELDS = [500, 5_000, 50_000, 500_000] as const;
/** The duration example: 500 cm² hunted at 5 000 cm². */
const DURATION_FIELD = 5_000;
const DURATION_AMOUNT = 500;

/**
 * cm² per hour with no losses against 1 % of losses, measured with the engine (Armes = Bouclier = 4, Vitesse de
 * chasse 3, 4 slots) for docs/research/chasse.md, « Ce que ça change pour le joueur ». Too slow to plan on each render.
 */
const NO_LOSS = [
  { field: 500, army: "3 000 Tueuses", none: 2_908, onePercent: 13_178 },
  { field: 4_496, army: "2 112 JSN et 146 SN", none: 0, onePercent: 184 },
  { field: 4_496, army: "3 000 Tueuses", none: 87, onePercent: 2_789 },
  { field: 4_496, army: "20 000 JSN et 2 000 Tanks", none: 0, onePercent: 3_605 },
] as const;

const promotable = UNITS.filter((unit) => unit.promotesTo !== null);
const unitName = (key: string | null) => UNITS.find((unit) => unit.key === key)?.name ?? key;

function Table({ caption, head, rows, note }: { caption: string; head: string[]; rows: string[][]; note?: string }) {
  return (
    <figure className="m-0 overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-raised">
              {head.map((cell, index) => (
                <th key={cell} scope="col" className={index === 0 ? "px-3 py-2 text-left" : "px-3 py-2 text-right"}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("|")} className="border-t">
                {row.map((cell, index) => (
                  <td key={index} className={index === 0 ? "px-3 py-1.5" : "px-3 py-1.5 text-right"}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">{note}</figcaption>}
    </figure>
  );
}

export default function HuntGuidePage() {
  const amountFor = (field: number) => Math.round(field / 10);
  return (
    <GuidePage id={entry.id} headings={HEADINGS}>
      <GuideSection heading={HEADINGS[0]} index={1}>
        <p>
          Une chasse envoie une partie de votre armée conquérir des cm² de <strong>Terrain de Chasse</strong> (TDC).
          Gagnée, elle rapporte deux choses au retour :
        </p>
        <ul>
          <li>
            les cm² visés, ajoutés à votre TDC : chaque cm² peut faire travailler une ouvrière de plus, qui récolte 48
            ressources par jour ;
          </li>
          <li>la nourriture des proies tuées, les carcasses.</li>
        </ul>
        <p>
          Perdue, elle coûte toute l&apos;armée envoyée. Tout l&apos;art est donc de chasser assez gros pour que ça
          vaille le coup, sans dépasser ce que l&apos;armée peut battre.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[1]} index={2}>
        <Rule certainty="checked" detail="rapport du 7 oct. 2026">
          La <strong>difficulté</strong> d&apos;une chasse de <em>s</em> cm² se calcule avec votre TDC{" "}
          <strong>au moment du combat</strong>, pas au lancement. Sous 50 cm², le jeu compte 50.
        </Rule>
        <pre className="overflow-x-auto rounded-[0.625rem] bg-raised px-3.5 py-3 font-mono text-[0.8125rem] leading-relaxed">
          {`palier          = 1,04 ^ arrondi(10 × log10(TDC / 50))
difficulté      = (s + 1 % du TDC) × palier × 3
nourriture      = 0,8 × difficulté`}
        </pre>
        <p>
          Deux effets s&apos;ajoutent. Le <strong>palier</strong> monte de 4 % chaque fois que le TDC grandit
          d&apos;environ 26 % : plus vous êtes grand, plus chaque cm² est défendu. Et le terme fixe,{" "}
          <strong>1 % du TDC</strong>, se paie à chaque chasse, quelle que soit sa taille.
        </p>
        <Table
          caption="Difficulté d'une chasse d'un dixième du TDC, selon le TDC"
          head={["TDC", "Chasse", "Difficulté", "Par cm² chassé"]}
          rows={FIELDS.map((field) => {
            const amount = amountFor(field);
            const hard = difficulty(field, amount);
            return [
              `${formatNumber(field)} cm²`,
              `${formatNumber(amount)} cm²`,
              formatNumber(Math.round(hard)),
              formatDecimal(hard / amount, 1),
            ];
          })}
          note={`Calculé par Optizzz. À taille relative égale, un cm² est ${formatDecimal(
            difficulty(500_000, 50_000) / 50_000 / (difficulty(500, 50) / 50),
            1,
          )} fois plus défendu à 500 000 cm² qu'à 500.`}
        />
      </GuideSection>

      <GuideSection heading={HEADINGS[2]} index={3}>
        <Rule certainty="unchecked">
          Une chasse dure <strong>(TDC au lancement + s) × 0,9 ^ Vitesse de chasse</strong> secondes : chaque niveau de
          Vitesse de chasse retire 10 % du temps.
        </Rule>
        <Table
          caption="Durée d'une chasse de 500 cm² à 5 000 cm² de TDC, selon la Vitesse de chasse"
          head={["Vitesse de chasse", "Durée", "Chasses à la fois"]}
          rows={[0, 3, 6, 10].map((level) => [
            String(level),
            spelledDuration(huntDurationSeconds(DURATION_FIELD, DURATION_AMOUNT, level)),
            String(level + 1),
          ])}
          note={`Une chasse de ${formatNumber(DURATION_AMOUNT)} cm² à ${formatNumber(DURATION_FIELD)} cm² de TDC.`}
        />
        <p>
          Vous pouvez avoir <strong>Vitesse de chasse + 1</strong> chasses en route en même temps. Lancées ensemble,
          elles ont la même durée et reviennent dans l&apos;ordre du lancement ; chacune combat au TDC laissé par les
          précédentes. La troisième de trois chasses de 100 cm² combat donc avec 200 cm² de plus que la première : elle
          est un peu plus difficile.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[3]} index={4}>
        <Rule certainty="checked" detail="aide du jeu">
          Il y a {PREYS.length} proies, de la petite araignée au tamanoir. Chacune a sa vie et ses dégâts ; sa{" "}
          <strong>valeur</strong>, √(vie × dégâts) / 1,1, compte pour la nourriture et les promotions.
        </Rule>
        <Table
          caption="Les proies de la chasse, dans l'ordre où elles encaissent"
          head={["Proie", "Dégâts", "Vie", "Nourriture"]}
          rows={PREYS.map((prey) => [
            prey.name,
            formatNumber(prey.damage),
            formatNumber(prey.hp),
            formatDecimal(prey.food, 1),
          ])}
        />
        <p className="flex flex-wrap items-center gap-2">
          <CertaintyMark certainty="players" />
          <span>
            Le jeu tire les proies au hasard jusqu&apos;à couvrir la nourriture visée : un type au hasard, de quoi
            couvrir 45 à 75 % de ce qui reste, et ainsi de suite. Les petites chasses relevées, faites de 4 à 40 proies
            des dix premiers types, vont dans ce sens.
          </span>
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[4]} index={5}>
        <Rule certainty="checked" detail="35 rapports, oct. 2026">
          <ul>
            <li>Chaque tour, les deux camps frappent en même temps, avec ce qui leur reste de survivants.</li>
            <li>
              <strong>Armes</strong> ajoute 10 % d&apos;attaque par niveau, <strong>Bouclier</strong> 10 % de vie.
            </li>
            <li>
              Les coups tombent dans l&apos;ordre des listes : les proies dans l&apos;ordre du tableau ci-dessus, vos
              unités dans l&apos;ordre de la ponte. Les Jeunes Soldates Naines encaissent en premier.
            </li>
            <li>
              Si votre attaque dépasse 1,5, 2 ou 3 fois la vie de toutes les proies, leur premier coup ne fait que 50,
              30 ou 10 % de ses dégâts.
            </li>
            <li>Vous gagnez si toutes les proies meurent et qu&apos;il vous reste quelqu&apos;un.</li>
          </ul>
        </Rule>
        <p>
          C&apos;est pourquoi on parle de <strong>ratio</strong> : votre attaque, Armes comprises, divisée par la
          difficulté. Plus il est haut, moins les proies ripostent.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[5]} index={6}>
        <Rule certainty="checked" detail="rapports du 7 oct. 2026">
          Le rapport compte comme tuées les unités tombées à 0 de vie : « en tue 4 » pour 4,99 Jeunes Soldates Naines de
          dégâts.
        </Rule>
        <Rule certainty="players">
          Une unité qui a perdu <strong>plus de la moitié</strong> de sa vie ne rentre pas, même quand le rapport
          n&apos;en compte aucune de tuée. Vous en perdez donc souvent un peu plus que le rapport ne le dit.
        </Rule>
        <p>
          Les simulateurs d&apos;Optizzz comptent les pertes de cette façon, la plus prudente, et affichent aussi le
          chiffre que donnerait le rapport.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[6]} index={7}>
        <Rule certainty="checked" detail="rapports du 7 oct. 2026">
          Après une victoire, une part des survivantes de chaque type monte d&apos;un rang :{" "}
          {promotable.map((unit) => `${unit.name} → ${unitName(unit.promotesTo)}`).join(", ")}.
        </Rule>
        <p>
          La part promue dépend du rapport entre la valeur des proies tuées et le poids de l&apos;armée envoyée, au
          carré, et l&apos;Étable à cochenilles l&apos;augmente de 10 % par niveau. Exemple relevé : 1 921 Jeunes
          Soldates Naines et 119 Soldates Naines contre 43 petites araignées, Armes et Bouclier 4 : 5 Jeunes Soldates
          Naines sont devenues des Soldates Naines.
        </p>
        <p>
          Conséquence pratique : <strong>envoyer moins d&apos;unités promeut une plus grande part</strong> de celles qui
          partent. Une armée trop grosse pour sa chasse gagne sans risque, mais ne fait presque monter personne.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[7]} index={8}>
        <p>
          <strong>Chasser à zéro perte ne vaut presque jamais le coup.</strong> Le terme fixe de 1 % du TDC attire des
          proies qui blessent toujours quelques Jeunes Soldates Naines à plus de la moitié de leur vie, même pour 1 cm².
          Accepter 1 % de pertes change tout :
        </p>
        <Table
          caption="cm² gagnés par heure selon les pertes acceptées"
          head={["TDC", "Armée", "Zéro perte", "1 % de pertes"]}
          rows={NO_LOSS.map((row) => [
            `${formatNumber(row.field)} cm²`,
            row.army,
            `${formatNumber(row.none)} cm²/h`,
            `${formatNumber(row.onePercent)} cm²/h`,
          ])}
          note="Calculé par Optizzz : Armes et Bouclier 4, Vitesse de chasse 3, quatre chasses à la fois."
        />
        <p>
          Pour la même raison, <strong>une grosse chasse vaut souvent mieux que plusieurs petites</strong> : chacune
          paie le terme fixe. À {formatNumber(DURATION_FIELD)} cm² de TDC, une chasse de 300 cm² a une difficulté
          d&apos;environ {formatNumber(Math.round(difficulty(DURATION_FIELD, 300)))} ; trois chasses de 100 cm², environ{" "}
          {formatNumber(Math.round(3 * difficulty(DURATION_FIELD, 100)))} à elles trois, sans compter le TDC qui monte
          entre la première et la dernière.
        </p>
        <p>
          La nourriture suit la difficulté : la grosse chasse en rapporte environ{" "}
          {formatNumber(Math.round(foodTarget(DURATION_FIELD, 300)))}, les trois petites un peu plus. C&apos;est le seul
          avantage du découpage, et il se paie en pertes.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[8]} index={9}>
        <ul className="grid list-none! gap-3 pl-0! sm:grid-cols-2">
          {[
            {
              kicker: "Extension",
              title: "Lanceur de chasse",
              text: "Sur la page Ressources du jeu : les chasses qui rapportent le plus pour les pertes que vous acceptez, lancées en un clic.",
              href: "#installer",
            },
            {
              kicker: "Outil",
              title: "Simulateur de chasse",
              text: "Le même calcul sans l'extension : votre armée, vos niveaux, votre TDC.",
              href: siteToolPath("hunt"),
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
              La règle de la demi-vie : à vérifier en comparant l&apos;armée avant et après une chasse, sans ponte entre
              les deux.
            </li>
            <li>La formule de la durée, relevée mais pas encore recoupée sur plusieurs chasses.</li>
            <li>Le tirage des proies : reconstitué par des joueurs, il colle aux rapports relevés sans être prouvé.</li>
            <li>
              La question « chasse si longue ? » que pose parfois le jeu : la durée qui la déclenche n&apos;est pas
              connue.
            </li>
          </ul>
        </div>
      </GuideSection>
    </GuidePage>
  );
}
