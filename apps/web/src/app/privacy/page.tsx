import type { Metadata } from "next";
import { PageHeader } from "~/components/panel";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-6 text-sm leading-relaxed [&>section]:border-b [&>section]:pb-6">
      <PageHeader kicker="Optizzz" title="Confidentialité" />
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Ce que le site sait de vous</h2>
        <p>
          Sans Compte Optizzz, le site lui-même ne pose aucun cookie et ne mesure pas l&apos;audience. Le serveur du
          site, à Amsterdam chez Scaleway (Union européenne), ne garde pas de journal des visites : votre adresse IP
          sert à vous répondre, sans être enregistrée (la limite des demandes de lien de connexion la garde une minute
          en mémoire).
        </p>
        <p>
          Ce que vous choisissez sur la carte d&apos;un serveur ou saisissez dans un outil (armées, niveaux…) reste dans
          votre navigateur : un lien partagé le garde après le <code>#</code> de l&apos;adresse (
          <code>/s5/map#p=…</code>, <code>/tools/combat#p=…</code>), une partie que le navigateur n&apos;envoie jamais
          au site. Votre dernière carte, le dernier état de chaque outil et vos niveaux («&nbsp;Mes niveaux&nbsp;») sont
          gardés dans le stockage local de votre navigateur, pour les retrouver ; le site ne les lit pas.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">La publicité</h2>
        <p>
          Les pages publiques (accueil, serveurs, outils) montrent des publicités de Google AdSense, marquées
          «&nbsp;Publicité&nbsp;». Elles sont non personnalisées : le site dit à Google, avant tout chargement, que vous
          ne consentez ni aux cookies publicitaires ni au ciblage, et ne vous le demande jamais. Google choisit alors
          ses annonces sans vous suivre ni vous profiler. Comme pour toute ressource chargée depuis un autre site,
          Google reçoit votre adresse IP et l&apos;adresse de la page ; il peut garder une trace technique contre la
          fraude aux clics. Ses règles :{" "}
          <a href="https://policies.google.com/technologies/ads?hl=fr" className="underline">
            la publicité chez Google
          </a>
          . Les Espaces d&apos;alliance, votre compte et la connexion n&apos;ont aucune publicité, et un bloqueur de
          publicité ne gêne en rien le site.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Avec un Compte Optizzz</h2>
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
          L&apos;extension Optizzz peut être liée à votre compte, si vous cliquez «&nbsp;Connecter mon Compte
          Optizzz&nbsp;» dans ses paramètres : le navigateur lui demande alors l&apos;accès à optizzz.fr, et la page
          «&nbsp;Connecter l&apos;extension&nbsp;» lui donne un jeton propre à ce navigateur. Le site n&apos;en garde
          qu&apos;une empreinte, avec le nom du navigateur («&nbsp;Chrome&nbsp;») et la date ; le jeton ne sert
          qu&apos;à l&apos;extension, jamais à ouvrir une session du site. Liée, l&apos;extension vous propose de
          rattacher votre Joueur : sur votre clic, elle envoie le pseudo affiché dans le jeu et son serveur, et le site
          garde ce Joueur (serveur, numéro de l&apos;export public, pseudo, date). Un Joueur n&apos;appartient qu&apos;à
          un seul compte. Sans extension liée, rien de l&apos;extension n&apos;arrive au site.
        </p>
        <p>
          Pour un Espace d&apos;alliance, le site garde l&apos;espace (serveur, tag, nom, date), ses membres (Joueur,
          rôle, date) et les demandes à rejoindre. Les données de l&apos;alliance sont chiffrées dans votre navigateur
          avec une Clé d&apos;alliance que le site ne connaît pas : il n&apos;en garde que des copies scellées pour
          chaque membre. Votre phrase secrète ne quitte jamais votre navigateur ; le site garde votre clé publique et
          votre clé privée chiffrée par cette phrase, ainsi que vos vérifications du Code de sécurité, chiffrées pour
          vous seul. Les autorisations signées par les Admins (qui est membre, qui est Admin) sont gardées en clair.
          Quand un Admin donne l&apos;accès, son extension remet à la page de l&apos;espace, dans son navigateur, la
          dernière liste des membres lue sur la page Membres du jeu : elle n&apos;est pas envoyée au site. Pour les
          Admins et Délégués, la page de l&apos;espace en tire les membres absents de l&apos;alliance et depuis
          quand&nbsp;: ces alertes sont gardées chiffrées avec la Clé d&apos;alliance. Une clé privée ouverte reste dans
          votre navigateur le temps de la session, ou 30 jours si vous cochez «&nbsp;Se souvenir sur cet appareil&nbsp;»
          ; «&nbsp;Se déconnecter&nbsp;» l&apos;efface.
        </p>
        <p>
          Les Envois : dans l&apos;extension, chaque Joueur choisit ce qui part vers son espace, tout décoché au départ
          (convois, floods, production, chasses, armée, niveaux et chantiers). Quand l&apos;accès à l&apos;espace est
          ouvert sur une page de l&apos;espace, celle-ci remet la Clé d&apos;alliance à l&apos;extension de ce
          navigateur (jamais votre clé privée), qui la garde aussi longtemps que votre clé ouverte et l&apos;oublie
          quand vous vous déconnectez. L&apos;extension chiffre chaque convoi avant de l&apos;envoyer : le site garde,
          par convoi, quel Joueur l&apos;a envoyé, dans quel espace, une empreinte tirée de la Clé d&apos;alliance (qui
          reconnaît le même convoi vu par ses deux joueurs sans dire lesquels), la version de la clé et la date où il
          l&apos;efface, 90 jours après l&apos;arrivée ; ni l&apos;expéditeur, ni le destinataire, ni les quantités en
          clair. De même pour chaque attaque en route (floods) : sa cible, son arrivée et, lancée avec le Plan de flood,
          la prise attendue sont chiffrées, et le site l&apos;efface 7 jours après l&apos;arrivée. L&apos;armée envoyée
          avec un flood part dans un second chiffré, que le site ne renvoie qu&apos;aux Admins de l&apos;espace :
          c&apos;est le site qui la leur réserve, pas le chiffrement, puisque tous les membres ont la même Clé
          d&apos;alliance. Les états (production et stock des entrepôts, chasses, armée, niveaux et chantiers avec la
          capacité des entrepôts) tiennent chacun dans une seule ligne chiffrée par Joueur, avec le dernier relevé et le
          précédent ; le site l&apos;efface 90 jours sans nouvel Envoi, ou dès que la catégorie est décochée. Le détail
          de l&apos;armée par unité part, comme l&apos;armée d&apos;un flood, dans un second chiffré réservé aux Admins,
          effacé dès que le Joueur ne l&apos;envoie plus. Il garde aussi les catégories que chaque Joueur envoie,
          montrées aux membres de l&apos;espace. Tous les membres lisent les Envois de l&apos;espace (sauf ces armées
          détaillées, aux Admins seuls) ; un non-membre, rien. Le site note qui a changé l&apos;accès à l&apos;espace et
          quand («&nbsp;Accès changé le … par Pseudo&nbsp;»).
        </p>
        <p>
          Les Demandes&nbsp;: un membre qui envoie Production et Convois peut demander des ressources pour une
          construction ou une recherche. Ce qu&apos;il demande (bâtiment ou recherche, niveaux, nourriture et matériaux)
          est chiffré dans son navigateur avec la Clé d&apos;alliance. Le site garde en clair ce qui lui sert à
          appliquer les règles&nbsp;: quel Joueur demande, dans quel espace, l&apos;état de la Demande (à valider,
          validée, refusée, close, annulée), l&apos;ordre que le demandeur lui donne, les dates, et le pseudo de
          l&apos;Admin ou du Délégué qui a décidé. «&nbsp;Couverte&nbsp;» n&apos;est pas gardé&nbsp;: chaque membre le
          calcule dans son navigateur d&apos;après les convois rattachés à la Demande, qui sont des Envois chiffrés
          comme les autres convois. Tous les membres voient les Demandes ; une Demande close, annulée ou refusée est
          effacée 90 jours après. Le jour voulu et «&nbsp;autofinancée&nbsp;» sont chiffrés avec le reste ; quand un
          Admin ou un Délégué suspend ou clôt la Demande d&apos;un autre, le site garde son pseudo. «&nbsp;Déclarer un
          convoi&nbsp;» envoie depuis le navigateur du membre, sur ce seul clic, un convoi chiffré comme les autres,
          effacé 90 jours après son arrivée.
        </p>
        <p>
          Rôles de la Chaîne de TDC&nbsp;: les Admins et les Délégués d&apos;un espace y règlent qui est grenier,
          passeur ou chasseur, et ce que chaque chasseur garde. Ces rôles sont chiffrés dans leur navigateur avec la Clé
          d&apos;alliance&nbsp;: le site les garde sans pouvoir les lire, avec en clair le pseudo de qui les a
          enregistrés et la date. L&apos;extension de chaque membre les relève, chiffrés, et les ouvre elle-même.
        </p>
        <p>
          Discord&nbsp;: un Admin d&apos;un espace peut y enregistrer l&apos;adresse du webhook du salon Discord de
          l&apos;alliance et choisir ce qui y est annoncé (aujourd&apos;hui les convois et les floods, sans l&apos;armée
          envoyée ; rien d&apos;avance). L&apos;adresse et ce choix sont chiffrés dans son navigateur avec la Clé
          d&apos;alliance&nbsp;: le site les garde sans pouvoir les lire, et ne poste jamais rien sur ce webhook.
          C&apos;est l&apos;extension du membre qui agit qui poste, juste après un Envoi, seulement pour une catégorie
          qu&apos;il envoie et une fois qu&apos;il a autorisé Discord dans son extension&nbsp;; ce qui est posté va
          alors à Discord, un service tiers choisi par l&apos;alliance. Quand Discord refuse un message,
          l&apos;extension n&apos;envoie au site que le code de la réponse&nbsp;: le site garde ce code, la date et le
          pseudo du membre, montrés aux Admins jusqu&apos;au prochain enregistrement du webhook.
        </p>
        <p>
          Rappels du site sur Discord&nbsp;: un Admin peut aussi donner au site l&apos;adresse d&apos;un second webhook,
          réservé aux rappels, et choisir lesquels partent (rien d&apos;avance). Le site y poste alors lui-même un court
          rappel, au plus un de chaque sorte toutes les 30 minutes («&nbsp;Nouveaux floods sur l&apos;espace XYZ, à voir
          sur Optizzz&nbsp;» et le lien vers l&apos;espace), sans pseudo, ni nombre, ni cible, ni heure. Cette
          adresse-là, le site peut la lire&nbsp;: elle est chiffrée au repos avec une clé du site, ce qui la protège
          d&apos;une copie volée de la base, pas de qui fait tourner le site. Si Discord dit que ce webhook
          n&apos;existe plus, le site garde le code de la réponse et la date, et suspend les rappels jusqu&apos;à un
          nouvel enregistrement.
        </p>
        <p>
          Depuis «&nbsp;Mon compte&nbsp;», vous pouvez retirer une extension liée, vous déconnecter de ce navigateur ou
          partout, et supprimer votre compte : tout ce qui lui appartient (connexions, extensions liées, Joueurs, place
          dans les espaces, clés, vérifications, Envois, Demandes) est effacé tout de suite. Une copie reste au plus 30
          jours dans les sauvegardes de la base (en France, chez Scaleway), puis disparaît.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Les joueurs affichés</h2>
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
