import type { Metadata } from "next";
import { PageHeader } from "~/components/panel";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalPage() {
  return (
    <article className="max-w-3xl space-y-6 text-sm leading-relaxed [&>section]:border-b [&>section]:pb-6">
      <PageHeader kicker="Optizzz" title="Mentions légales" />
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Éditeur</h2>
        <p>
          Optizzz est édité à titre non professionnel par Axel Lavoie, qui a communiqué son identité complète à
          l&apos;hébergeur. Contact : par les{" "}
          <a href="https://github.com/Achaak/Optizzz/issues" className="underline">
            issues GitHub du projet
          </a>
          .
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Hébergeur</h2>
        <p>
          Scaleway SAS, 8 rue de la Ville l&apos;Évêque, 75008 Paris, France. Le site et sa base de données sont à
          Amsterdam (Pays-Bas), dans l&apos;Union européenne ; leurs sauvegardes, à Paris.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Données affichées</h2>
        <p>
          Les joueurs, alliances et scores viennent de l&apos;export public de Fourmizzz, publié par le jeu pour chaque
          serveur. Optizzz n&apos;est ni édité ni approuvé par Fourmizzz.
        </p>
      </section>
    </article>
  );
}
