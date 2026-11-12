// « À propos »: who makes Optizzz, what it does, where its data and rules come from, what it does not do
// (docs/features/site-a-propos.md). No ad here.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "~/components/icons";
import { PageHeader, SmallLabel } from "~/components/panel";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Optizzz, un site et une extension d'aide au jeu Fourmizzz faits par un joueur : ce qu'ils font, d'où viennent leurs données et leurs règles.",
  alternates: { canonical: "/about" },
};

const SOURCE = "https://github.com/Achaak/Optizzz";
const CONTACT = "axel.lavoie@gmail.com";

function Offer({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[0.875rem] bg-card p-5 text-sm shadow-panel">
      <SmallLabel>{kicker}</SmallLabel>
      <h3 className="font-heading text-2xl leading-none font-bold uppercase">{title}</h3>
      <div className="guide-text text-muted-foreground">{children}</div>
    </div>
  );
}

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="guide-text space-y-3 text-[0.9375rem] leading-relaxed">
      <h2 id={id} className="font-heading text-3xl leading-none font-bold uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <PageHeader kicker="À propos" title="Un outil de joueur, pour les joueurs">
        Optizzz aide à jouer à Fourmizzz : un site public pour suivre les serveurs et faire ses calculs, une extension
        pour avoir ces calculs directement dans les pages du jeu. Optizzz n&apos;est ni édité ni soutenu par Fourmizzz.
      </PageHeader>

      <section aria-labelledby="about-what" className="space-y-3.5">
        <h2 id="about-what" className="font-heading text-3xl leading-none font-bold uppercase">
          Ce que fait Optizzz
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Offer kicker="Le site, sans compte" title="Serveurs, outils, guides">
            <ul>
              <li>classements, courbes et carte de chaque serveur ;</li>
              <li>le Journal : qui arrive, part, change d&apos;alliance ou est colonisé ;</li>
              <li>simulateurs de chasse, de combat et de flood, temps de trajet, coûts ;</li>
              <li>
                des <Link href="/guides">guides</Link> qui expliquent les règles derrière ces calculs.
              </li>
            </ul>
          </Offer>
          <Offer kicker="L'extension, Chrome et Firefox" title="Dans les pages du jeu">
            <p>
              Elle lit les pages que vous ouvrez et y ajoute ce qui manque : la meilleure chasse pour votre armée, la
              ponte, les convois, la chaîne de l&apos;alliance, les fins de chantier. Chaque ajout se coupe depuis ses
              réglages.
            </p>
          </Offer>
          <Offer kicker="Avec un Compte Optizzz" title="Les Espaces d'alliance">
            <p>
              Un lieu partagé par les membres d&apos;une alliance : demandes, convois, floods, chaîne. Tout y est
              chiffré dans votre navigateur avec une clé que seule l&apos;alliance connaît : le site garde des données
              qu&apos;il ne peut pas lire.
            </p>
          </Offer>
        </div>
      </section>

      <div className="grid items-start gap-x-10 gap-y-9 lg:grid-cols-2">
        <Part id="about-data" title="D'où viennent les données">
          <p>
            Les pages des serveurs reposent sur l&apos;<strong>export public</strong> que Fourmizzz publie pour chaque
            serveur : pseudos, alliances, positions, Terrain de Chasse et scores. Optizzz le relit{" "}
            <strong>chaque heure</strong>.
          </p>
          <ul>
            <li>Un relevé par jour, celui de minuit (heure de Paris), fait les courbes.</li>
            <li>
              Le Journal compare chaque relevé au précédent. Il commence au premier passage d&apos;Optizzz sur le
              serveur.
            </li>
            <li>
              Rien ne vient de vos pages de jeu, sauf ce que vous envoyez vous-même à votre Espace d&apos;alliance.
            </li>
          </ul>
        </Part>

        <Part id="about-rules" title="Comment les règles sont vérifiées">
          <p>
            Le jeu ne publie pas toutes ses formules. Celles qu&apos;utilise Optizzz viennent de l&apos;aide du jeu, de
            rapports de chasse et de combat relevés sur de vrais comptes, et de ce que constatent les joueurs.
          </p>
          <p>
            Dans les guides, chaque règle porte une mention : <strong>vérifié</strong> (avec la date),{" "}
            <strong>d&apos;après les joueurs</strong> ou <strong>non vérifié</strong>. Les outils et les guides
            partagent le même code : une règle corrigée change les deux.
          </p>
        </Part>

        <Part id="about-not" title="Ce que le site ne fait pas">
          <ul>
            <li>
              Pas de mesure d&apos;audience. Le seul cookie que pose le site est celui de la connexion à un Compte
              Optizzz.
            </li>
            <li>
              Des annonces <strong>non personnalisées</strong> sur quelques pages publiques, jamais dans les Espaces ni
              à côté d&apos;un formulaire : elles paient l&apos;hébergement.
            </li>
            <li>
              L&apos;extension n&apos;envoie rien au site tant que vous ne l&apos;avez pas reliée à votre compte, et
              ensuite seulement sur un clic.
            </li>
          </ul>
          <p>
            <Link href="/privacy">Lire la politique de confidentialité</Link>
          </p>
        </Part>

        <Part id="about-code" title="Un code ouvert">
          <p>
            Le code d&apos;Optizzz, site et extension, est public, sous licence <strong>MIT</strong>. Vous pouvez lire
            comment chaque calcul est fait, signaler une erreur ou proposer une correction.
          </p>
          <a
            href={SOURCE}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 py-2 font-semibold hover:bg-accent"
          >
            Voir le code source <ArrowRightIcon />
          </a>
        </Part>
      </div>

      <section
        aria-labelledby="about-who"
        className="grid gap-x-10 gap-y-5 rounded-[0.875rem] bg-card p-5 text-sm shadow-panel md:grid-cols-2"
      >
        <div className="space-y-2">
          <h2 id="about-who" className="font-heading text-[1.625rem] leading-none font-bold uppercase">
            Qui fait Optizzz
          </h2>
          <p className="text-muted-foreground">
            Optizzz est fait par Achak, sur son temps libre. Je jouais beaucoup à Fourmizzz il y a une vingtaine
            d&apos;années et je reviens au jeu de temps en temps depuis. Aujourd&apos;hui, je joue surtout sur S5, avec
            des comptes sur S1 à S4. Le site et l&apos;extension sont nés des calculs qu&apos;on refait à la main dans
            une alliance.
          </p>
        </div>
        <div className="guide-text space-y-2">
          <h2 className="font-heading text-[1.625rem] leading-none font-bold uppercase">M&apos;écrire</h2>
          <p className="text-muted-foreground">
            Une règle fausse, un chiffre qui ne colle pas avec un de vos rapports, une idée d&apos;outil :
          </p>
          <ul>
            <li>
              Courriel : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
            </li>
            <li>
              Erreurs et idées : <a href={`${SOURCE}/issues`}>les tickets du code source</a>
            </li>
          </ul>
        </div>
      </section>

      <p className="text-[0.8125rem] text-muted-foreground">
        Fourmizzz est un jeu de Fourmizzz.fr. Les noms du jeu (unités, bâtiments, recherches) lui appartiennent ;
        Optizzz ne s&apos;en sert que pour décrire le jeu.
      </p>
    </div>
  );
}
