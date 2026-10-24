import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Confidentialité</h1>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ce que le site sait de vous</h2>
        <p>
          Sans Compte Optizzz, rien : pas de cookie, pas de mesure d&apos;audience ni de publicité. Comme tout site,
          l&apos;hébergeur (Vercel) garde un temps les journaux techniques des requêtes, adresse IP comprise, pour faire
          fonctionner le service.
        </p>
        <p>
          Ce que vous choisissez sur la carte d&apos;un serveur ou saisissez dans un outil (armées, niveaux…) reste dans
          votre navigateur : un lien partagé le garde après le <code>#</code> de l&apos;adresse (
          <code>/s5/map#p=…</code>, <code>/tools/combat#p=…</code>), une partie que le navigateur n&apos;envoie jamais
          au site. Votre dernière carte, le dernier état de chaque outil et vos niveaux (« Mes niveaux ») sont gardés
          dans le stockage local de votre navigateur, pour les retrouver ; le site ne les lit pas.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Avec un Compte Optizzz</h2>
        <p>
          Le compte est facultatif : les outils et les données des serveurs restent ouverts sans lui. Il ne tient
          qu&apos;à votre adresse e-mail, sans mot de passe. Le site garde cette adresse, la date de création du compte
          et vos connexions (une par navigateur, 30 jours prolongés à chaque visite) ; ni votre adresse IP ni votre
          navigateur n&apos;y sont notés. Un lien de connexion ne vaut que 15 minutes et ne sert qu&apos;une fois ; le
          site n&apos;en garde qu&apos;une empreinte.
        </p>
        <p>
          Un seul cookie, celui de la connexion, posé quand vous vous connectez et effacé quand vous vous déconnectez.
          Les liens de connexion partent par un service d&apos;envoi d&apos;e-mails (Brevo, société française, données
          dans l&apos;Union européenne), qui ne reçoit que votre adresse et le message.
        </p>
        <p>
          Depuis « Mon compte », vous pouvez vous déconnecter de ce navigateur ou partout, et supprimer votre compte :
          tout ce qui lui appartient est effacé tout de suite.
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
