# Comptes Optizzz et Espaces d'alliance (étape 3)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 12). Étape 3 de `site-optizzz.md`. Vocabulaire : `GLOSSARY.md`. Décisions de fond : ADR 0005 (facultatif, chiffré de bout en bout) 0007 (libsodium, Better Auth, liaison de l'extension) et 0008 (le site écrit les comptes dans le schéma `accounts`, avec le rôle `optizzz_app`). Les Envois viennent à l'étape 4 (cadrage 19).

## Adresses

En anglais, comme le reste du site (`site-outils.md`) ; ce que lit le visiteur reste en français.

| Page                                | Adresse              |
| ----------------------------------- | -------------------- |
| Connexion (lien magique)            | `/login`             |
| Compte                              | `/account`           |
| Connecter l'extension               | `/connect-extension` |
| Mes espaces, en créer, en rejoindre | `/spaces`            |
| Un espace                           | `/spaces/[id]`       |

En-tête : « Se connecter », ou « Mon compte » une fois connecté. Les pages publiques restent sans cookie pour qui n'est pas connecté : le cookie de session n'est posé qu'à la connexion, et la page Confidentialité le dit.

## Compte Optizzz

- **Inscription et connexion** par lien magique (Better Auth), avec le seul e-mail. Le lien vaut 15 minutes et ne sert qu'une fois. En local, il s'affiche dans la console du serveur.
- **Fournisseur d'e-mails : Brevo** (français, données dans l'UE). Le ticket 13 vérifie ses tarifs du jour avant de créer le compte.
- **Session** : 30 jours, prolongée à chaque visite. « Se déconnecter » ferme celle de l'appareil ; `/account` propose aussi « Se déconnecter partout ».
- **`/account`** : l'e-mail, les Joueurs rattachés, les extensions liées (« Chrome, lié le 24 oct. », « Retirer »), la Phrase de chiffrement (changer, « J'ai oublié ma phrase »), la suppression du compte.
- **Supprimer son compte** efface tout de suite : e-mail, sessions, jetons d'extension, Joueurs, clés, appartenances (et, à l'étape 4, les Envois). C'est bloqué tant qu'on est le dernier Admin d'un espace qui a d'autres membres (« Nommez un autre Admin de [nom] d'abord ») ; seul dans un espace, celui-ci est supprimé avec le compte.

## Phrase de chiffrement et clés

- **Quand** : demandée à la création ou à la demande d'un premier Espace d'alliance, pas à l'inscription. La paire de clés personnelle naît à ce moment-là, dans le navigateur ; la clé privée est chiffrée par la phrase (Argon2id) et stockée sur le site (ADR 0005, 0007).
- **Règles** : au moins 16 caractères, saisis deux fois. « Proposer une phrase » tire cinq mots français au hasard, dans le navigateur. Avertissement : « Optizzz ne peut pas la retrouver. Perdue, il faudra qu'un Admin vous réapprouve. » Pas de jauge de force.
- **Changer de phrase** rechiffre la clé privée ; la paire ne change pas.
- **Sur un appareil** : la clé privée déchiffrée reste ouverte pendant la session du navigateur (`sessionStorage`). Case « Se souvenir sur cet appareil » (décochée par défaut ; note : à éviter sur un appareil partagé) : gardée 30 jours dans le stockage du navigateur. « Se déconnecter » l'efface de l'appareil.
- **Phrase oubliée** (`/account`, après une confirmation qui dit ce qui va se passer) : nouvelle paire. Les appartenances et les rôles restent, mais chaque espace marque le membre « clé à renvoyer » ; tout Admin la renvoie par le chemin d'une approbation (vérification de la page Membres comprise). D'ici là, le membre ne lit rien. Si la personne était le seul Admin d'un espace, l'avertissement le dit avant de confirmer : personne ne pourra lui renvoyer la clé.
- **L'extension** n'a besoin d'aucune clé à l'étape 3 ; son déverrouillage se décide au cadrage 19.

## Joueurs et extension

- **Un Joueur n'est rattaché que par l'extension**, qui lit le pseudo dans l'en-tête du jeu. Quand l'extension est liée et que le Joueur de la page n'est pas rattaché, elle propose une fois « Rattacher Pseudo (S5) à votre Compte Optizzz » (popup et « Fonctionnalités ») ; un refus est mémorisé. Rien ne part sans ce clic.
- Un Joueur n'appartient qu'à un seul compte : une seconde déclaration est refusée (« déjà rattaché à un autre compte ; contactez-nous »). Le site affiche « déclaré par l'extension le … ». Ce n'est pas une preuve (ADR 0005) : l'Admin reste le contrôle humain.
- **Liaison** (ADR 0007) : la page `/connect-extension` transmet un jeton à l'extension par un script injecté. Un jeton par navigateur, valable jusqu'à ce qu'on le retire (`/account` ou « Déconnecter » dans l'extension). Il ne sert qu'à l'API de l'extension, jamais de session du site ; le site n'en garde qu'un hachage.
- **Permission `optizzz.fr` facultative** (`optional_host_permissions`), demandée au clic sur « Connecter mon Compte Optizzz » : la mise à jour ne désactive l'extension de personne. La lecture publique de la carte reste sans permission (CORS). Voir l'ADR 0007.
- **Page Membres** : l'extension garde la dernière liste des membres de son alliance lue sur la page Membres du jeu, avec sa date (lecture `collect`, jamais de requête au jeu pour ça). Elle sert à l'approbation et aux alertes de départ.

## Espaces d'alliance

- **L'appartenance est celle d'un Joueur** (un pseudo sur un Serveur), avec son rôle : une personne avec des Joueurs sur S2 et S5 peut être dans un espace sur chaque serveur. La paire de clés est celle du Compte.
- **Créer** : un Joueur crée un espace pour son alliance, sur son Serveur ; le tag vient de l'export, il ne se tape pas. Nom libre, par défaut « [TAG] sur S5 ». Le créateur devient Admin ; la Clé d'alliance est générée dans son navigateur.
- **Rejoindre** : on choisit parmi les espaces de son alliance sur ce Serveur, présentés avec leur nom, leurs Admins (pseudos), leur nombre de membres et leur date de création. Une demande en attente au plus par espace et par Joueur, annulable, sans message (on se parle sur Discord). Après un refus, on peut redemander ; l'Admin voit « refusée le … ».
- **Approuver** : « Approuver » demande à l'extension liée de l'Admin sa dernière liste de la page Membres.
  - Pseudo trouvé dans une liste de moins de 24 heures : l'Admin scelle pour la clé publique du nouveau membre **toutes les versions de la Clé d'alliance** qu'il détient (l'historique de l'espace appartient à l'alliance ; la Priorité a besoin des convois des 30 derniers jours).
  - Sinon : « Ouvrez la page Membres de votre alliance dans le jeu, puis revenez ».
  - Sans extension liée, on ne peut pas approuver. « Refuser » ne demande rien.
- **Rôles** : plusieurs Admins. Tout Admin nomme ou retire des Admins et des Délégués, sauf le dernier Admin, qu'on ne peut pas retirer. Le créateur n'a pas de privilège après la création. Le dernier Admin ne peut pas quitter l'espace sans nommer quelqu'un, sauf s'il est seul : l'espace est alors supprimé.
- **Page d'un espace** :
  - Membres : pseudo, rôle, membre depuis, état de la clé (« à jour », « à renvoyer ») ;
  - Demandes à rejoindre (Admins) ;
  - Alertes (Admins et Délégués) ;
  - Réglages : nom, « Quitter », et pour un Admin « Supprimer l'espace », en tapant son nom (tout est effacé, chiffré compris) ;
  - une note : les Envois arrivent à l'étape suivante.
- **Départs** (ticket 18) : un membre absent de la page Membres du jeu est signalé chez les Admins et Délégués dès la première lecture où il manque, avec « absent depuis le … » ; l'alerte s'efface s'il revient. Rien n'est retiré tout seul. Exclure est un clic d'Admin : l'accès est coupé, une nouvelle version de la Clé d'alliance est générée et scellée pour les membres restants ; les anciennes versions restent pour relire les anciennes données.

## Ce que garde le site

Tout ce qui suit vit dans le schéma Postgres `accounts`, que le site de production écrit avec le rôle `optizzz_app` et que le rôle en lecture seule `optizzz_read` ne voit pas (ADR 0008). E-mail, sessions, hachages des jetons d'extension, Joueurs (serveur, id, pseudo, date de déclaration), clé publique et clé privée chiffrée (avec les paramètres d'Argon2id), espaces (serveur, tag, nom), appartenances (Joueur, rôle, date), Clés d'alliance scellées (une par membre et par version), demandes à rejoindre. Jamais la Phrase de chiffrement, jamais une clé en clair.
