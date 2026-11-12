// The « Nourriture et entretien » guide (docs/features/site-guides.md): the two resources, the workers' harvest, the
// mushroom farm, the army's upkeep, famine, the colony tax, convoys and a day's balance. Rules:
// docs/research/ressources-et-entretien.md; figures computed with @optizzz/game.
import { carriedPerWorker } from "@optizzz/game/aphids";
import { UNITS } from "@optizzz/game/army/units";
import { HARVESTS_PER_DAY } from "@optizzz/game/forecast";
import { formatNumber } from "@optizzz/game/format/number-format";
import { colonyTaxRate } from "@optizzz/game/production";
import type { Metadata } from "next";
import Link from "next/link";
import { CertaintyMark, GuidePage, GuideSection, Rule, type GuideHeading } from "~/components/guides/guide-parts";
import { SmallLabel } from "~/components/panel";
import { guide, guidePath } from "~/lib/guides/guides";

const entry = guide("food");

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: guidePath(entry.id) },
};

const HEADINGS = [
  { id: "ressources", title: "Deux ressources" },
  { id: "recolte", title: "La récolte des ouvrières" },
  { id: "champignonniere", title: "La champignonnière" },
  { id: "entretien", title: "Ce que mange l'armée" },
  { id: "famine", title: "La famine" },
  { id: "taxe", title: "La taxe de colonie" },
  { id: "convois", title: "Les convois" },
  { id: "bilan", title: "Le bilan d'une journée" },
  { id: "optizzz", title: "Avec Optizzz" },
  { id: "non-verifie", title: "Ce qui n'est pas vérifié" },
] as const satisfies readonly GuideHeading[];

/** Share of its food cost a unit eats a day, by where it is (game tutorial, docs/research). */
const UPKEEP = [
  { place: "Dehors : TDC, chasse, attaque", share: 0.05 },
  { place: "Fourmilière", share: 0.1 },
  { place: "Loge", share: 0.15 },
] as const;
const UPKEEP_UNITS = ["JSN", "SN", "S", "A", "Tk", "Tu"] as const;

/** The day's balance example: an invented colonized player. */
const DAY = {
  field: 6_000,
  workers: 8_000,
  foodWorkers: 3_000,
  /** Champignonnière 9, as read on S5 (8 538 a day). */
  mushroom: 8_538,
  aphidsOfMaster: 10,
  army: { key: "JSN", count: 3_000 },
} as const;

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

function DayBalance() {
  const working = Math.min(DAY.field, DAY.workers);
  const idle = DAY.workers - working;
  const materialWorkers = working - DAY.foodWorkers;
  const foodHarvest = DAY.foodWorkers * HARVESTS_PER_DAY;
  const materialHarvest = materialWorkers * HARVESTS_PER_DAY;
  const rate = colonyTaxRate(DAY.aphidsOfMaster);
  const foodTax = Math.floor(rate * (foodHarvest + DAY.mushroom));
  const materialTax = Math.floor(rate * materialHarvest);
  const unit = UNITS.find((candidate) => candidate.key === DAY.army.key);
  const armyFood = DAY.army.count * (unit?.food ?? 0) * 0.05;
  const rows = [
    ["Récolte des ouvrières", `+ ${formatNumber(foodHarvest)}`, `+ ${formatNumber(materialHarvest)}`],
    ["Champignonnière", `+ ${formatNumber(DAY.mushroom)}`, "—"],
    [
      `Taxe de colonie (${formatNumber(Math.round(rate * 100))} %)`,
      `− ${formatNumber(foodTax)}`,
      `− ${formatNumber(materialTax)}`,
    ],
    ["Armée", `− ${formatNumber(armyFood)}`, "—"],
    [
      "Par jour",
      formatNumber(foodHarvest + DAY.mushroom - foodTax - armyFood),
      formatNumber(materialHarvest - materialTax),
    ],
  ];
  return (
    <>
      <p>
        Un joueur inventé : {formatNumber(DAY.field)} cm² de TDC, {formatNumber(DAY.workers)} ouvrières dont{" "}
        {formatNumber(DAY.foodWorkers)} à la nourriture, une Champignonnière 9, {formatNumber(DAY.army.count)}{" "}
        {unit?.plural ?? DAY.army.key} sur le TDC, colonisé par un joueur qui a l&apos;Étable à pucerons{" "}
        {DAY.aphidsOfMaster}.
      </p>
      <Table
        caption="Le bilan d'une journée du joueur de l'exemple"
        head={["", "Nourriture", "Matériaux"]}
        rows={rows}
        note="Calculé par Optizzz avec les règles de ce guide. Le jeu n'affiche pas ce net : il faut le faire soi-même."
      />
      {idle > 0 && (
        <p>
          {formatNumber(idle)} ouvrières ne travaillent pas : il n&apos;y a que {formatNumber(DAY.field)} cm² pour
          elles. Chasser leur donnerait du travail ; sinon, elles ne rapportent rien.
        </p>
      )}
    </>
  );
}

export default function FoodGuidePage() {
  const upkeepUnits = UPKEEP_UNITS.flatMap((key) => UNITS.filter((unit) => unit.key === key));
  return (
    <GuidePage id={entry.id} headings={HEADINGS}>
      <GuideSection heading={HEADINGS[0]} index={1}>
        <p>Une fourmilière vit de deux ressources :</p>
        <ul>
          <li>
            la <strong>nourriture</strong>, pour pondre, faire les recherches et nourrir l&apos;armée ;
          </li>
          <li>
            les <strong>matériaux</strong>, pour construire et faire les recherches.
          </li>
        </ul>
        <p>
          Les deux viennent surtout des ouvrières. La nourriture a en plus la champignonnière, les carcasses des chasses
          et le pillage ; elle a aussi une dépense que les matériaux n&apos;ont pas : l&apos;armée la mange, jour et
          nuit.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[1]} index={2}>
        <Rule certainty="checked" detail="Ressources, 7 oct. 2026">
          Une ouvrière au travail rapporte <strong>1 ressource toutes les 30 minutes</strong>, soit {HARVESTS_PER_DAY}{" "}
          par jour, en nourriture ou en matériaux selon où vous l&apos;avez mise.
        </Rule>
        <Rule certainty="checked" detail="Ressources, 7 oct. 2026">
          Une ouvrière travaille sur 1 cm² de Terrain de Chasse : au travail, il y a{" "}
          <strong>le plus petit des deux</strong>, votre TDC ou vos ouvrières. Le reste ne récolte rien.
        </Rule>
        <p>
          La récolte n&apos;arrive pas en continu mais <strong>par paquets</strong>, toutes les 30 minutes, à une heure
          propre à chaque joueur (pas forcément à :00 ou :30). Pour savoir quand vous pourrez payer un chantier, il faut
          donc compter en paquets : il manque 8 892 matériaux avec 4 004 ouvrières, il faut 3 paquets.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[2]} index={3}>
        <Rule certainty="checked" detail="construction, S5">
          La champignonnière produit de la nourriture <strong>en continu</strong>, sans ouvrière : 5 022 par jour au
          niveau 8, 8 538 au niveau 9. Sa description, dans la page des constructions, donne la production du niveau
          actuel et du suivant.
        </Rule>
        <p>
          Elle compte peu face aux ouvrières d&apos;une grosse fourmilière, mais beaucoup au début, et elle ne dépend
          pas du TDC.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[3]} index={4}>
        <Rule certainty="checked" detail="Ressources, 7 oct. 2026">
          Chaque jour, une unité mange une part de son <strong>coût en nourriture</strong> (celui de la page Reine),
          selon l&apos;endroit où elle se trouve. Les ouvrières ne mangent rien. Les troupes en route (chasse, attaque)
          comptent comme dehors.
        </Rule>
        <Table
          caption="Nourriture mangée chaque jour par 1 000 unités, selon l'endroit"
          head={["Pour 1 000", ...UPKEEP.map((row) => `${row.place} (${formatNumber(row.share * 100)} %)`)]}
          rows={upkeepUnits.map((unit) => [
            unit.plural,
            ...UPKEEP.map((row) => formatNumber(Math.round(1000 * unit.food * row.share))),
          ])}
        />
        <p>
          Une même armée mange donc <strong>trois fois plus dans la Loge que sur le TDC</strong>. La Loge protège mieux
          (le guide du <Link href={guidePath("combat")}>combat</Link> dit pourquoi) : c&apos;est un choix entre sûreté
          et nourriture. Une chasse qui rentre pose ses troupes sur le TDC, au même tarif que pendant la chasse.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[4]} index={5}>
        <Rule certainty="checked" detail="aide du jeu">
          Sans nourriture, l&apos;armée perd <strong>0,5 % toutes les 30 minutes</strong>.
        </Rule>
        <p>
          C&apos;est lent mais sans fin : 24 heures de famine coûtent environ{" "}
          {formatNumber(Math.round((1 - 0.995 ** 48) * 1000) / 10)} % de l&apos;armée. Surveillez le stock avant une
          grosse ponte ou un départ en vacances.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[5]} index={6}>
        <Rule certainty="checked" detail="aide du jeu, page Ressources">
          Un joueur colonisé reverse à son colonisateur <strong>20 % + 1 % par niveau</strong> de l&apos;Étable à
          pucerons du colonisateur, sur la récolte de ses ouvrières et sur sa champignonnière. La page Ressources du
          colonisé donne le taux.
        </Rule>
        <ul>
          <li>La consommation de l&apos;armée n&apos;entre pas dans le calcul : la taxe porte sur ce qui arrive.</li>
          <li>Les chiffres « Chaque jour, vous récoltez… » de la page Ressources sont avant la taxe.</li>
          <li>Le colonisateur ne touche rien des colonies de son colonisé.</li>
        </ul>
      </GuideSection>

      <GuideSection heading={HEADINGS[6]} index={7}>
        <Rule certainty="checked" detail="aide du jeu">
          Un convoi envoie des ressources à un autre joueur, porté par des ouvrières : chacune porte{" "}
          {formatNumber(carriedPerWorker(0))} ressources, + 5 % par niveau d&apos;Étable à pucerons (
          {formatNumber(carriedPerWorker(10))} au niveau 10).
        </Rule>
        <p>
          Les ouvrières parties en convoi ne récoltent sans doute pas pendant le trajet : un gros convoi lointain
          coûterait aussi des heures de récolte. Le temps du trajet est expliqué dans le guide des{" "}
          <Link href={guidePath("travel")}>temps de trajet</Link>.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[7]} index={8}>
        <DayBalance />
      </GuideSection>

      <GuideSection heading={HEADINGS[8]} index={9}>
        <ul className="grid list-none! gap-3 pl-0! sm:grid-cols-2">
          {[
            {
              kicker: "Extension",
              title: "Prévisions de ressources",
              text: "Sur la page Ressources du jeu : quand vous pourrez payer un chantier, quand viendra la famine, quand un entrepôt sera plein.",
              href: "#installer",
            },
            {
              kicker: "Outil",
              title: "Coûts et durées",
              text: "Ce que coûte un bâtiment ou une recherche d'un niveau à un autre.",
              href: "/tools/costs",
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
            <li>La perte de 0,5 % toutes les 30 minutes en famine : écrite dans l&apos;aide, jamais observée.</li>
            <li>La taxe de colonie : prise paquet par paquet, ou en continu ?</li>
            <li>Ce que touche le colonisateur, vu de son côté : pas encore relevé.</li>
            <li>Que les ouvrières d&apos;un convoi ne récoltent pas pendant le trajet : déduit, pas mesuré.</li>
          </ul>
        </div>
      </GuideSection>
    </GuidePage>
  );
}
