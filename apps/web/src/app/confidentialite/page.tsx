import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Confidentialité</h1>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ce que le site sait de vous</h2>
        <p>
          Rien : pas de compte, pas de cookie, pas de mesure d&apos;audience ni de publicité. Comme tout site,
          l&apos;hébergeur (Vercel) garde un temps les journaux techniques des requêtes, adresse IP comprise, pour faire
          fonctionner le service.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Les joueurs affichés</h2>
        <p>
          Pseudos, alliances, positions et scores viennent de l&apos;export public de Fourmizzz, relu chaque heure ; le
          site en garde un relevé par jour pour les courbes, et la liste des changements. Les pages des joueurs et des
          alliances ne sont pas proposées aux moteurs de recherche. Pour une question ou une demande de retrait :{" "}
          <a href="https://github.com/Achaak/Optizzz/issues" className="underline">
            issues GitHub du projet
          </a>
          .
        </p>
      </section>
    </article>
  );
}
