import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalPage() {
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Mentions légales</h1>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Éditeur</h2>
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
        <h2 className="text-base font-semibold">Hébergeur</h2>
        <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Données affichées</h2>
        <p>
          Les joueurs, alliances et scores viennent de l&apos;export public de Fourmizzz, publié par le jeu pour chaque
          serveur. Optizzz n&apos;est ni édité ni approuvé par Fourmizzz.
        </p>
      </section>
    </article>
  );
}
