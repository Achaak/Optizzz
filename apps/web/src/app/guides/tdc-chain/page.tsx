import { formatNumber } from "@optizzz/game/format/number-format";
import { roleLabel, type Role } from "@optizzz/game/tdc-chain/roles";
import type { Metadata } from "next";
import Link from "next/link";
import { CertaintyMark, GuidePage, GuideSection, Rule, type GuideHeading } from "~/components/guides/guide-parts";
import { SmallLabel } from "~/components/panel";
import { guide, guidePath } from "~/lib/guides/guides";
import { tdcChainDemo } from "~/lib/guides/tdc-chain-demo";

const entry = guide("tdc-chain");

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: guidePath(entry.id) },
};

const HEADINGS = [
  { id: "but", title: "À quoi sert une chaîne" },
  { id: "regles", title: "Les règles d'une attaque" },
  { id: "roles", title: "Les rôles" },
  { id: "qui-prend", title: "Qui peut prendre à qui" },
  { id: "ordre", title: "L'ordre de passage" },
  { id: "optizzz", title: "Avec Optizzz" },
  { id: "non-verifie", title: "Ce qui n'est pas vérifié" },
] as const satisfies readonly GuideHeading[];

/** The shape of a role, as on the extension's map: the role never rests on color alone. */
const roleShape = (role: Role) =>
  role.kind === "granary" ? "■" : role.kind === "passer" ? "◆" : role.kind === "hunter" ? "●" : "▲";

const demo = tdcChainDemo();

function TakeMatrix() {
  return (
    <figure className="m-0 overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-[0.8125rem]">
          <caption className="sr-only">
            Ce que prend une attaque gagnée : attaquant en ligne, cible en colonne ; case vide, hors de portée
          </caption>
          <thead>
            <tr className="bg-raised text-right">
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Attaquant ↓ · cible →
              </th>
              {demo.members.map((member) => (
                <th key={member.id} scope="col" className="px-2.5 py-2 font-semibold">
                  {member.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-right">
            {demo.members.map((attacker, i) => (
              <tr key={attacker.id} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  <span aria-hidden="true">{roleShape(attacker.role)} </span>
                  {attacker.name}{" "}
                  <span className="font-normal text-muted-foreground">
                    <span className="sr-only">{roleLabel(attacker.role)}, </span>
                    {formatNumber(attacker.field)}
                  </span>
                </th>
                {demo.members.map((target, j) => {
                  const take = demo.matrix[i]?.[j] ?? null;
                  const planned = demo.planned.has(`${attacker.name}→${target.name}`);
                  if (i === j)
                    return (
                      <td key={target.id} className="px-2.5 py-2 text-muted-foreground">
                        —
                      </td>
                    );
                  return (
                    <td key={target.id} className={planned ? "bg-accent px-2.5 py-2 font-semibold" : "px-2.5 py-2"}>
                      {take === null ? (
                        <span className="sr-only">hors de portée</span>
                      ) : (
                        <>
                          {formatNumber(take)}
                          {planned && <span className="sr-only"> (dans l&apos;ordre de passage)</span>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
        ■ grenier · ◆ passeur · ● chasseur, avec leur TDC en cm². En gras sur fond : les attaques de l&apos;ordre de
        passage ci-dessous. Calculé par Optizzz avec les règles de la section 2.
      </figcaption>
    </figure>
  );
}

function PassingOrder() {
  return (
    <figure className="m-0 overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[0.8125rem]">
          <caption className="sr-only">
            Ordre de passage de l&apos;alliance inventée, dans l&apos;ordre des arrivées
          </caption>
          <thead>
            <tr className="bg-raised">
              <th scope="col" className="px-3 py-2 text-left">
                N°
              </th>
              <th scope="col" className="px-2.5 py-2 text-left">
                Attaquant → cible
              </th>
              <th scope="col" className="px-2.5 py-2 text-right">
                Fourmis
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                TDC après (attaquant / cible)
              </th>
            </tr>
          </thead>
          <tbody>
            {demo.hits.map((hit) => (
              <tr key={hit.n} className="border-t">
                <td className="px-3 py-2 font-mono">{hit.n}</td>
                <td className="px-2.5 py-2">
                  {hit.attacker} → {hit.target}
                </td>
                <td className="px-2.5 py-2 text-right">{formatNumber(hit.take)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatNumber(hit.attackerAfter)} / {formatNumber(hit.targetAfter)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-3.5 py-2.5 text-xs text-muted-foreground">
        Une arrivée par minute, dans l&apos;ordre des numéros. Les passeurs finissent comme ils ont commencé : seul le
        grenier garde ce qui monte.
      </figcaption>
    </figure>
  );
}

const hunters = demo.members.filter((member) => member.keep !== undefined);
const granaries = demo.members.filter((member) => member.role.kind === "granary");
const gap = demo.gap;

export default function TdcChainGuide() {
  return (
    <GuidePage id={entry.id} headings={HEADINGS}>
      <GuideSection heading={HEADINGS[0]} index={1}>
        <p>
          Les chasseurs gagnent du <strong>TDC</strong> (Terrain de Chasse, en cm²) en chassant. Une alliance le fait
          monter vers quelques gros membres, les <strong>greniers</strong>, par une suite d&apos;attaques entre membres
          : les <strong>floods</strong>. Chaque attaque prend du TDC à un membre plus petit et le donne à un plus gros.
        </p>
        <p>
          Dans une chaîne, chaque membre laisse son Terrain de Chasse sans défense : une attaque gagne sans combat et
          prend ce que les règles lui permettent. Tout l&apos;art est dans l&apos;ordre des attaques, pour que chacune
          trouve sa cible à portée à son arrivée.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[1]} index={2}>
        <div className="space-y-2.5">
          <Rule certainty="checked" detail="aide du jeu">
            <strong>Portée</strong> : vous n&apos;attaquez qu&apos;un joueur dont le TDC est entre <strong>50 %</strong>{" "}
            (inclus) et <strong>300 %</strong> (exclu) du vôtre.
          </Rule>
          <Rule certainty="unchecked">
            La portée est revérifiée <strong>à l&apos;arrivée</strong> de chaque attaque : entre-temps, d&apos;autres
            attaques ou des chasses ont pu changer les deux TDC. Par prudence, Optizzz garde une marge d&apos;1 %
            au-dessus des 50 %.
          </Rule>
          <Rule certainty="checked" detail="aide du jeu">
            <strong>Prise</strong> : une attaque gagnée prend <strong>20 %</strong> du TDC de la cible, et pas plus
            d&apos;1 cm² par fourmi. Pour prendre {formatNumber(demo.hits[0]?.take ?? 0)} cm², envoyez au moins{" "}
            {formatNumber(demo.hits[0]?.take ?? 0)} fourmis.
          </Rule>
          <Rule certainty="checked" detail="8 oct. 2026">
            <strong>Attaques à la fois</strong> : Vitesse d&apos;attaque + 1, moins vos attaques déjà en route. Avec la
            Vitesse d&apos;attaque 4, cinq attaques peuvent être en route en même temps.
          </Rule>
        </div>
      </GuideSection>

      <GuideSection heading={HEADINGS[2]} index={3}>
        <p>Chaque membre a un rôle, et chaque rôle un échelon : seul un échelon plus haut attaque un plus bas.</p>
        <ul>
          <li>
            <strong>■ Grenier</strong> : garde le TDC qui monte. Un Grenier 2 est un échelon au-dessus du Grenier 1 et
            peut le flooder.
          </li>
          <li>
            <strong>◆ Passeur</strong> : reçoit le TDC d&apos;en dessous et le redonne au-dessus ; il finit comme il a
            commencé. Le Passeur 1 est juste au-dessus des chasseurs.
          </li>
          <li>
            <strong>● Chasseur</strong> : chasse, garde le TDC qu&apos;il veut et donne le reste.
          </li>
          <li>
            <strong>À flooder</strong> (tout son TDC monte), <strong>Ne pas toucher</strong> (la chaîne le laisse
            tranquille), <strong>Hors chaîne</strong>.
          </li>
        </ul>
        <p>
          Pour commencer, Optizzz propose des rôles d&apos;après le TDC : les plus gros en greniers, puis à chaque
          échelon ceux que le plus petit de l&apos;échelon du dessus peut attaquer. L&apos;alliance les ajuste ensuite.
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[3]} index={4}>
        <p>
          Une alliance inventée de {demo.members.length} membres : {granaries.map((member) => member.name).join(" et ")}{" "}
          en greniers, deux passeurs, trois chasseurs. Chaque case donne ce que la ligne prend à la colonne en une
          attaque ; une case vide, hors de portée.
        </p>
        <TakeMatrix />
      </GuideSection>

      <GuideSection heading={HEADINGS[4]} index={5}>
        <p>
          Les chasseurs gardent{" "}
          {hunters
            .map((member) => `${member.name} ${formatNumber(member.keep ?? 0)} cm²`)
            .join(", ")
            .replace(/, ([^,]*)$/, " et $1")}
          . Le reste monte, d&apos;échelon en échelon, jusqu&apos;au plus petit grenier qu&apos;il peut atteindre, en
          commençant par le plus gros surplus. Le haut de la chaîne frappe parfois d&apos;abord : les passeurs prêtent
          avant d&apos;être remboursés.
        </p>
        <PassingOrder />
        {gap && (
          <div
            role="note"
            className="flex gap-2.5 rounded-xl border border-warning-border bg-warning-soft px-3.5 py-3 text-sm"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            >
              <path d="M12 3 2 21h20zM12 10v5M12 18h.01" />
            </svg>
            <div>
              <strong>Chaîne cassée</strong> : personne au-dessus ne peut attaquer {gap.name} ({formatNumber(gap.field)}{" "}
              cm²). Il faudrait un passeur entre {formatNumber(gap.min)} et {formatNumber(gap.max)} cm², que {gap.above}{" "}
              puisse attaquer et qui puisse attaquer {gap.name}.
              {gap.candidates.length > 0 &&
                ` ${gap.candidates.join(" ou ")} ${gap.candidates.length > 1 ? "ont" : "a"} ce TDC : en faire un passeur répare la chaîne.`}
            </div>
          </div>
        )}
        <p>
          {/* A full page load: the simulator reads its link (`#p=`) as it opens, before a client navigation sets it. */}
          <a
            href={demo.floodLink}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:brightness-110"
          >
            Essayer l&apos;attaque n° 1 dans le simulateur de flood
          </a>
        </p>
      </GuideSection>

      <GuideSection heading={HEADINGS[5]} index={6}>
        <ul className="grid list-none! gap-3 pl-0! sm:grid-cols-3">
          {[
            {
              kicker: "Extension",
              title: "Chaîne",
              text: "Dans la page Membres du jeu : rôles, qui peut prendre à qui, ordre de passage avec les horaires.",
              href: "#installer",
            },
            {
              kicker: "Espace d'alliance",
              title: "Rôles et plan",
              text: "Les rôles réglés une fois pour toute l'alliance, et qui flood qui, quand.",
              href: "/spaces",
            },
            {
              kicker: "Outil",
              title: "Simulateur de flood",
              text: "Une cible, une suite d'attaques, sans l'extension.",
              href: "/tools/flood",
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

      <GuideSection heading={HEADINGS[6]} index={7}>
        <div className="space-y-2 rounded-xl border-2 border-dotted border-muted-foreground px-4 py-3.5 text-sm">
          <CertaintyMark certainty="unchecked" detail="pas encore relevé sur un vrai flood" />
          <ul>
            <li>
              La prise : arrondie en dessous, et « 1 cm² par fourmi » compte-t-il les fourmis envoyées ou celles qui
              survivent ?
            </li>
            <li>Que la portée soit revérifiée à l&apos;arrivée, et pas seulement au départ.</li>
            <li>La marge d&apos;1 % d&apos;Optizzz : une précaution, pas une règle du jeu.</li>
            <li>Le plan suppose que chaque membre a assez de fourmis pour ses attaques.</li>
          </ul>
        </div>
      </GuideSection>
    </GuidePage>
  );
}
