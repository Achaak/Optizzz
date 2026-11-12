// The « Les temps de trajet » guide (docs/features/site-guides.md): what a trip depends on, the distance, the formula
// and its measures, the Vitesse d'attaque and what it costs, convoys, reading a trip in the game. Rules:
// docs/research/temps-de-trajet.md; every figure computed by `travelTime` and `levelCost`.
import { formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { levelCost } from "@optizzz/game/level-costs";
import { siteToolPath } from "@optizzz/game/site-links/site";
import { distance, travelTime } from "@optizzz/game/travel";
import type { Metadata } from "next";
import Link from "next/link";
import { CertaintyMark, GuidePage, GuideSection, Rule, type GuideHeading } from "~/components/guides/guide-parts";
import { SmallLabel } from "~/components/panel";
import { spelledDuration } from "~/components/tools/tool-help";
import { guide, guidePath } from "~/lib/guides/guides";

const entry = guide("travel");

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: guidePath(entry.id) },
};

const HEADINGS = [
  { id: "depend", title: "De quoi dépend un trajet" },
  { id: "distance", title: "La distance" },
  { id: "formule", title: "La formule, et ses mesures" },
  { id: "loin", title: "Près ou loin" },
  { id: "vitesse", title: "La Vitesse d'attaque" },
  { id: "convois", title: "Les convois" },
  { id: "jeu", title: "Lire un trajet dans le jeu" },
  { id: "optizzz", title: "Avec Optizzz" },
  { id: "non-verifie", title: "Ce qui n'est pas vérifié" },
] as const satisfies readonly GuideHeading[];

/** The measures of docs/research/temps-de-trajet.md: positions, or the distance only, and what the game showed. */
const MEASURES = [
  { label: "Profil d'un joueur, 8 oct. 2026", from: { x: 55, y: 28 }, to: { x: 35, y: 8 }, speed: 3, game: 36_062 },
  { label: "Trois attaques, 4 nov. 2026", from: { x: 27, y: 1419 }, to: { x: 25, y: 1422 }, speed: 17, game: 1_089 },
] as const;

const DISTANCES = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const;
const SPEEDS = [0, 5, 10, 15] as const;
/** The distance of the « Vitesse d'attaque » examples. */
const NEAR = 10;
/** Where a trip reaches half its ceiling: 1 − e^(−d/350) = 1/2. */
const HALF_WAY = 350 * Math.log(2);
const CEILING = 637_200;

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

/** « 4 j 3 h 12 min » beyond a day, « 10 h 01 min 02 s » under. */
function longDuration(seconds: number): string {
  if (seconds < 86_400) return spelledDuration(seconds);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(days)} j ${String(hours)} h ${String(minutes).padStart(2, "0")} min`;
}

export default function TravelGuidePage() {
  const [profile] = MEASURES;
  const profileDistance = distance(profile.from, profile.to);
  const levels = [1, 5, 10, 15] as const;
  return (
    <GuidePage id={entry.id} headings={HEADINGS}>
      <GuideSection heading={HEADINGS[0]} index={1}>
        <p>
          Une attaque ou un convoi met un certain temps à aller d&apos;une fourmilière à l&apos;autre. Ce temps ne
          dépend que de deux choses :
        </p>
        <ul>
          <li>
            la <strong>distance</strong> entre les deux fourmilières, sur la carte du serveur ;
          </li>
          <li>
            la <strong>Vitesse d&apos;attaque</strong> de celui qui envoie.
          </li>
        </ul>
        <p>
          Ni la taille de l&apos;armée, ni le type d&apos;unités, ni le TDC ne comptent : 10 Jeunes Soldates Naines et
          10 000 Tanks arrivent en même temps.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[1]} index={2}>
        <p>
          Chaque fourmilière a une position (x ; y) sur la carte. La distance est celle d&apos;une ligne droite,
          calculée comme à l&apos;école avec Pythagore :
        </p>
        <pre className="overflow-x-auto rounded-[0.625rem] bg-raised px-3.5 py-3 font-mono text-[0.8125rem] leading-relaxed">
          {"distance = √((x₁ − x₂)² + (y₁ − y₂)²)"}
        </pre>
        <p>
          De ({profile.from.x} ; {profile.from.y}) à ({profile.to.x} ; {profile.to.y}), la distance vaut √(20² + 20²) ≈{" "}
          {formatDecimal(profileDistance, 2)} cases. Deux cases en diagonale sont donc plus loin que deux cases en
          ligne.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[2]} index={3}>
        <Rule certainty="checked" detail="profil du 8 oct. 2026 et attaques du 4 nov. 2026">
          <span className="font-mono text-[0.8125rem]">
            secondes = ⌊0,9 ^ Vitesse d&apos;attaque × 637 200 × (1 − e^(−distance / 350))⌋
          </span>
        </Rule>
        <p>
          Le résultat est arrondi à la seconde inférieure. Deux relevés dans le jeu tombent à la seconde près sur la
          formule :
        </p>
        <Table
          caption="Les trajets mesurés dans le jeu et ce que donne la formule"
          head={["Relevé", "Distance", "Vitesse d'attaque", "Formule", "Jeu"]}
          rows={MEASURES.map((measure) => {
            const far = distance(measure.from, measure.to);
            return [
              measure.label,
              formatDecimal(far, 2),
              String(measure.speed),
              spelledDuration(travelTime(far, measure.speed)),
              spelledDuration(measure.game),
            ];
          })}
        />
      </GuideSection>

      <GuideSection heading={HEADINGS[3]} index={4}>
        <p>
          Le temps grandit vite sur les premières cases, puis de moins en moins. Il ne dépasse jamais{" "}
          {formatNumber(CEILING)} secondes sans Vitesse d&apos;attaque, environ 7 jours et 9 heures, et en atteint la
          moitié vers {formatNumber(Math.round(HALF_WAY))} cases.
        </p>
        <Table
          caption="Durée d'un trajet selon la distance et la Vitesse d'attaque"
          head={["Distance", ...SPEEDS.map((speed) => `VA ${String(speed)}`)]}
          rows={DISTANCES.map((far) => [
            `${formatNumber(far)} case${far > 1 ? "s" : ""}`,
            ...SPEEDS.map((speed) => longDuration(travelTime(far, speed))),
          ])}
          note="VA : Vitesse d'attaque de celui qui envoie. Calculé par Optizzz avec la formule ci-dessus."
        />
        <p>
          Conséquence : entre voisins, chaque case compte ; à l&apos;autre bout de la carte, quelques cases de plus ou
          de moins ne changent presque rien.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[4]} index={5}>
        <Rule certainty="checked" detail="aide du jeu, 8 oct. 2026">
          Chaque niveau de Vitesse d&apos;attaque retire <strong>10 %</strong> du temps qui reste, pour les attaques
          comme pour les convois. Elle fixe aussi le nombre d&apos;attaques en route à la fois : Vitesse d&apos;attaque
          + 1.
        </Rule>
        <p>
          Les 10 % s&apos;appliquent l&apos;un après l&apos;autre : dix niveaux ne retirent pas tout le temps, ils le
          multiplient par 0,9¹⁰ ≈ {formatDecimal(0.9 ** 10, 2)}. Sur un trajet de {NEAR} cases, et ce que coûte chaque
          niveau, sans bonus :
        </p>
        <Table
          caption="Temps d'un trajet de 10 cases et coût de la Vitesse d'attaque, par niveau"
          head={["Niveau", `Trajet de ${String(NEAR)} cases`, "Nourriture", "Matériaux"]}
          rows={levels.map((level) => {
            const cost = levelCost("attackSpeed", level).cost;
            return [
              String(level),
              spelledDuration(travelTime(NEAR, level)),
              formatNumber(cost.food),
              formatNumber(cost.materials),
            ];
          })}
          note="Le coût est celui du niveau seul ; chaque niveau coûte le double du précédent."
        />
      </GuideSection>

      <GuideSection heading={HEADINGS[5]} index={6}>
        <Rule certainty="unchecked">
          Un convoi suit la même formule, avec la Vitesse d&apos;attaque de celui qui l&apos;envoie.
        </Rule>
        <p>
          Un seul convoi a été mesuré : il a mis environ 1 h 39 là où la formule donne 1 h 35, mais l&apos;heure de son
          départ n&apos;était connue qu&apos;à la minute. Gardez quelques minutes de marge quand un convoi doit arriver
          avant une échéance.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[6]} index={7}>
        <Rule certainty="checked" detail="8 oct. 2026">
          Le <strong>profil d&apos;un joueur</strong> affiche la distance et le temps de trajet depuis votre
          fourmilière, avec votre Vitesse d&apos;attaque. La distance y est arrondie à l&apos;entier supérieur (
          {formatDecimal(profileDistance, 2)} s&apos;affiche « {formatNumber(Math.ceil(profileDistance))} »), mais le
          temps utilise la distance exacte.
        </Rule>
        <p>
          Ce temps n&apos;a été vu que sur un compte avec le Compte+ ; sur un profil vu sans, il n&apos;était pas
          affiché. Pour une attaque déjà en route, le jeu donne l&apos;heure d&apos;arrivée : c&apos;est la mesure la
          plus sûre.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[7]} index={8}>
        <ul className="grid list-none! gap-3 pl-0! sm:grid-cols-2">
          {[
            {
              kicker: "Outil",
              title: "Temps de trajet",
              text: "Entre deux joueurs ou deux positions, avec l'heure d'arrivée si vous partez maintenant.",
              href: siteToolPath("travel"),
            },
            {
              kicker: "Extension",
              title: "Dans les pages du jeu",
              text: "Les trajets dans la carte de l'alliance, la chaîne, les cibles, le plan de flood et les convois.",
              href: "#installer",
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

      <GuideSection heading={HEADINGS[8]} index={9}>
        <div className="space-y-2 rounded-xl border-2 border-dotted border-muted-foreground px-4 py-3.5 text-sm">
          <CertaintyMark certainty="unchecked" />
          <ul>
            <li>
              L&apos;arrondi à la seconde inférieure : deux relevés le confirment, d&apos;autres profils le
              conforteraient (contre un arrondi au plus proche).
            </li>
            <li>Le temps d&apos;un convoi, mesuré une seule fois et à la minute près.</li>
            <li>
              La Vitesse d&apos;attaque des autres joueurs n&apos;est pas publique : leurs trajets vers vous sont
              estimés.
            </li>
          </ul>
        </div>
      </GuideSection>
    </GuidePage>
  );
}
