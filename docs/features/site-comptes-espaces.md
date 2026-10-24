# Comptes Optizzz et Espaces d'alliance (étape 3)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 12). Étape 3 de `site-optizzz.md`. Vocabulaire : `GLOSSARY.md`. Décisions de fond : ADR 0005 (facultatif, chiffré de bout en bout) et 0007 (libsodium, Better Auth, liaison de l'extension). Les Envois viennent à l'étape 4 (cadrage 19).

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

## Paquet de chiffrement (`@optizzz/crypto`)

Tickets 15 et 15b. Le format des octets et le modèle de confiance sont dans l'ADR 0005 (« Format chiffré ») ; ici, les fichiers et les choix.

- `packages/crypto/src/personal-key.ts` : `generateKeyPair` (une identité Ed25519 par personne, d'où l'on tire la paire X25519 des boîtes scellées : une seule clé publique, une seule phrase), `lockPrivateKey`, `unlockPrivateKey`, `changePassphrase` (même paire, nouveau sel).
- `passphrase.ts` : `passphraseProblem` (au moins 16 caractères tels que les voit le joueur, après normalisation), `suggestPassphrase` (« Proposer une phrase »), `normalizePassphrase`.
- `alliance-key.ts` : `createAllianceKeyring`, `rotateAllianceKey` (une version de plus), `sealAllianceKey` et `sealAllianceKeyring` (toutes les versions pour un nouveau membre), qui prennent `{ spaceId, recipient, admin }` : l'Admin signe chaque Clé d'alliance qu'il scelle ; `openAllianceKey` et `openAllianceKeyring`, qui prennent `{ spaceId, member, trusted }` et refusent une clé non signée, signée hors de la liste `trusted`, ou dont la signature vient d'un autre espace, d'une autre version ou d'un autre destinataire.
- `fingerprint.ts` : `fingerprint`, l'empreinte d'une clé publique en 24 chiffres par groupes de quatre, à comparer de vive voix ou sur Discord.
- `data.ts` : `encryptData` (version la plus haute), `decryptData` (version nommée par la donnée).
- `errors.ts` : `CryptoError`, avec un `code` et un message en français à montrer au joueur ; pour `untrusted-signer`, `signer` donne la clé qui a signé, pour en montrer l'empreinte.
- **Liste de confiance** : le paquet ne décide pas qui croire. C'est au ticket 17 de dire qui y entre (recommandé : l'Admin qui vous a approuvé, après comparaison de son empreinte), où elle vit sans que le site puisse y ajouter sa clé, comment on y fait entrer les autres Admins, et si l'Admin doit comparer l'empreinte du nouveau venu avant d'approuver (sans quoi le site peut substituer sa clé à la sienne). Détail dans l'ADR 0005, « Modèle de confiance ».
- **Liste de mots** (`words-fr.ts`) : les 2 048 mots français de BIP-39, repris de [trezor/python-mnemonic](https://github.com/trezor/python-mnemonic) (`src/mnemonic/wordlist/french.txt`), licence MIT (© 2013-2016 Pavol Rusnak, notice recopiée en tête du fichier), mis en NFC. Mots de 5 à 8 lettres, sans deux mots aux quatre mêmes premières lettres, même sans accents. Cinq mots tirés par `randombytes_uniform` (générateur cryptographique, sans biais) : 5 × 11 = **55 bits**. Avec Argon2id à 64 Mio, essayer la moitié des phrases demande de l'ordre de 2⁵⁴ dérivations, hors de portée de qui volerait la base.
- **Argon2id** : `opslimit = 3`, `memlimit = 64 Mio`, justifiés dans l'ADR 0005. La dérivation bloque le fil où elle tourne (environ une seconde sur téléphone) : l'interface la lancera dans un Web Worker ou derrière un indicateur d'attente. Non mesuré sur un vrai téléphone.
- **Saisie** : le champ de la phrase coupe la majuscule automatique (`autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`) : la casse compte, les espaces en trop et la forme Unicode des accents non.
- **Jamais dans le script léger de l'extension** (ADR 0007) : ESLint (`eslint.config.js`) interdit d'importer `@optizzz/crypto` ou libsodium, même par `import()`, partout dans `apps/extension/src` sauf `entrypoints/background.ts` et les pages de l'extension (dossiers d'`entrypoints/` qui ne sont pas des `.content`), ainsi que dans `packages/game` et `packages/map`. `packages/crypto/src/extension-guard.test.ts` vérifie que la règle se déclenche bien là où il faut.
- **Clés signées** (ticket 15b) : une boîte scellée est anonyme ; sans signature, qui écrit dans la base pourrait glisser à un membre une Clé d'alliance qu'il connaît. Chaque Clé d'alliance scellée porte donc la signature de l'Admin qui l'a scellée (format 2). Les tests jouent les attaques : clé non signée (format 1 ou signature vide), signée par une clé hors de la liste, signature rejouée dans un autre espace, pour une autre version ou pour un autre destinataire, clé remplacée sous une signature valable.
- **Limite connue** : la signature ne prouve pas qu'une version est la dernière ; le site peut cacher la plus récente à un membre. À trancher au cadrage des Envois (19).

## Ce que garde le site

E-mail, sessions, hachages des jetons d'extension, Joueurs (serveur, id, pseudo, date de déclaration), clé publique et clé privée chiffrée (avec les paramètres d'Argon2id), espaces (serveur, tag, nom), appartenances (Joueur, rôle, date), Clés d'alliance scellées (une par membre et par version), demandes à rejoindre. Jamais la Phrase de chiffrement, jamais une clé en clair.
