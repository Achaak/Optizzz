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
- **Approuver** : le Code de sécurité doit d'abord avoir été échangé avec le nouveau venu (« Confiance et parcours » ci-dessous). « Donner l'accès » demande ensuite à l'extension liée de l'Admin sa dernière liste de la page Membres.
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

## Confiance et parcours

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-25, avant le ticket 17. Le pourquoi et les formats : ADR 0005, « Modèle de confiance ». Exigence du propriétaire : facile pour qui ne connaît rien aux clés de chiffrement, et facile pour un Admin de donner l'accès à ses membres. L'Admin ne manipule jamais de clé : sceller, signer et tenir la liste de confiance se fait sans lui.

- **Vocabulaire** : jamais « clé », « chiffrement », « certificat » ni « empreinte » dans les écrans courants. On dit **accès à l'espace** et **Code de sécurité** (`GLOSSARY.md`). Une ligne « Pourquoi ? », repliée, l'explique en deux phrases : « Ce code prouve que vous parlez bien à Pseudo, et pas à quelqu'un qui se ferait passer pour lui. Même Optizzz ne peut pas lire les données de votre alliance. » La Phrase de chiffrement s'affiche « Phrase secrète de votre compte », avec le terme exact en dessous.
- **Inviter** : « Copier le lien d'invitation » donne un lien vers l'espace, sans aucun secret (jamais de clé dans un lien). Qui l'ouvre est guidé pas à pas, avec une barre d'étapes : se connecter, connecter l'extension, rattacher son pseudo, choisir sa phrase, puis la demande est faite pour cet espace. Une étape déjà faite est passée.
- **Échanger le Code de sécurité** (obligatoire, sans case « j'ai comparé ») :
  - le nouveau venu, après sa demande, choisit l'Admin avec qui il parle (sauté s'il n'y en a qu'un) ; il voit « Envoyez ce code à Pseudo sur Discord », un bouton « Copier », et un champ « Collez le code que Pseudo vous a envoyé » ;
  - l'Admin, sur la demande, voit « Copier mon code » et « Collez le code de Pseudo » ;
  - chaque côté a son propre code (tirés tous deux des deux clés publiques) : coller le sien ne marche pas. Chaque navigateur calcule le code attendu de l'autre et compare tout seul ; espaces et tirets sont ignorés, les chiffres peuvent aussi se taper (lus de vive voix) ;
  - codes concordants : « Donner l'accès » s'active chez l'Admin, et le nouveau venu, qui a collé un code concordant, accepte d'office les clés que cet Admin a signées pour lui. Il lit l'espace dès que l'Admin a donné l'accès, sans autre geste ;
  - codes différents : « Les codes ne correspondent pas. N'allez pas plus loin et prévenez-nous. » Rien n'est retenu ;
  - l'Admin n'a donc que deux gestes : envoyer le lien, puis coller le code reçu et cliquer « Donner l'accès ».
- **Phrase secrète** : une phrase de cinq mots est proposée d'office, avec « En choisir une autre » ; le champ est marqué pour que le navigateur ou le gestionnaire de mots de passe propose de l'enregistrer (`autocomplete="new-password"`, l'e-mail comme identifiant) ; case obligatoire « Je l'ai notée ou enregistrée ». Rien d'autre.
- **Nommer un Admin** : si l'on a déjà échangé le Code de sécurité avec cette personne (on l'a fait entrer), un clic : « Nommer Admin ». Sinon, le même échange s'affiche d'abord. Le certificat d'Admin est signé sans que personne le voie.
- **Liste de confiance** : les clés qu'on a vérifiées par un code, et ce qu'elles ont signé (certificats de membre et d'Admin, révocations), d'où l'on déduit qui croire. Gardée sur le site, chiffrée et authentifiée avec une clé tirée de la clé privée du membre : le site ne peut ni la lire ni y glisser une clé, et elle suit le membre sur tous ses appareils. Après une phrase oubliée (nouvelle paire), elle est perdue : la réapprobation la refait.
- **Plusieurs Admins** : à l'approbation, l'Admin signe un certificat de membre (cet espace, cette clé) ; à la nomination, un certificat d'Admin. Un membre croit l'Admin qui l'a fait entrer et les Admins que celui-ci, ou un Admin déjà cru, a certifiés ; un Admin croit de même la clé d'un membre qu'un Admin cru a certifié. C'est ce qui permet, après une exclusion, de sceller la nouvelle version pour tous les membres restants, et à chacun d'accepter une version scellée par un autre Admin. Retirer un Admin ou exclure un membre signe une révocation.
- **Clé changée** : jamais acceptée en silence. Une signature par une clé inconnue, ou un Admin dont la clé a changé (phrase oubliée), affiche « La clé de Pseudo a changé » et refuse ce qu'elle a signé jusqu'à ce qu'un Admin cru la recertifie, après un nouvel échange du Code de sécurité. Le membre « clé à renvoyer » repasse par l'échange, comme une demande.
- **Ce qui reste ouvert** : un site qui cacherait la dernière version de la Clé d'alliance ou une révocation (cadrage 19, avant les Envois) ; deux versions de même numéro, refusées par le site (ticket 18).

## Paquet de chiffrement (`@optizzz/crypto`)

Tickets 15, 15b et 15c. Le format des octets et le modèle de confiance sont dans l'ADR 0005 (« Format chiffré ») ; ici, les fichiers et les choix.

- `packages/crypto/src/personal-key.ts` : `generateKeyPair` (une identité Ed25519 par personne, d'où l'on tire la paire X25519 des boîtes scellées : une seule clé publique, une seule phrase), `lockPrivateKey`, `unlockPrivateKey`, `changePassphrase` (même paire, nouveau sel).
- `passphrase.ts` : `passphraseProblem` (au moins 16 caractères tels que les voit le joueur, après normalisation), `suggestPassphrase` (« Proposer une phrase »), `normalizePassphrase`.
- `alliance-key.ts` : `createAllianceKeyring`, `rotateAllianceKey` (une version de plus), `sealAllianceKey` et `sealAllianceKeyring` (toutes les versions pour un nouveau membre), qui prennent `{ spaceId, recipient, admin }` : l'Admin signe chaque Clé d'alliance qu'il scelle ; `openAllianceKey` et `openAllianceKeyring`, qui prennent `{ spaceId, member, trusted }` et refusent une clé non signée, signée hors de la liste `trusted`, ou dont la signature vient d'un autre espace, d'une autre version ou d'un autre destinataire.
- `fingerprint.ts` : `fingerprint`, l'empreinte d'une clé publique en 24 chiffres par groupes de quatre, à comparer de vive voix ou sur Discord.
- `data.ts` : `encryptData` (version la plus haute), `decryptData` (version nommée par la donnée).
- `errors.ts` : `CryptoError`, avec un `code` et un message en français à montrer au joueur ; pour `untrusted-signer`, `signer` donne la clé qui a signé, pour en montrer l'empreinte. Les messages de `bad-certificate` et `unreadable-trust-list` disent « certificat » et « liste de confiance » : à reformuler dans l'interface du ticket 17, qui évite ces mots dans les écrans courants.
- `pair-code.ts` (ticket 15c) : `pairCodes(mine, theirs)` donne `{ mine, theirs }`, le Code de sécurité à envoyer et celui qu'on attend de l'autre ; `matchesPairCode(collé, attendu)` compare en ignorant espaces, tirets et retours à la ligne. Chaque code est tiré de la seule clé de celui qui l'envoie : un code tiré des deux clés mêlées se laisserait trouver par le site en 2⁴⁰ essais (ADR 0005, « Code de sécurité d'une paire »).
- `certificate.ts` (ticket 15c) : `signCertificate({ kind, spaceId, subject, admin, issuedAt? })` pour les quatre sortes (`member`, `admin`, `admin-revocation`, `exclusion`), `openCertificate(blob, spaceId)` qui vérifie la signature pour cet espace (`bad-certificate` sinon).
- `trust.ts` (ticket 15c) : `whoToTrust({ spaceId, verified, certificates })` donne `{ admins, members }` : les `admins` vont dans `trusted` d'`openAllianceKey`, les `members` disent pour qui sceller. Révocation croisée : ni l'un ni l'autre n'est cru ; un Admin exclu fait tomber tout ce qu'il a signé. Règles et pourquoi : ADR 0005, « Qui croire ».
- `trust-list.ts` (ticket 15c) : `lockTrustList(list, owner)` et `unlockTrustList(blob, owner)`, la liste de confiance (`{ spaces: SpaceTrust[] }`) chiffrée et authentifiée avec une clé tirée de la graine Ed25519 du membre ; une autre clé ou un octet changé donne `unreadable-trust-list`.
- **Liste de confiance** : le paquet calcule qui croire, l'interface (ticket 17) décide quand une clé y entre (après un Code de sécurité concordant), garde la liste sur le site et signe les certificats. Obligations qui en découlent, détaillées dans l'ADR 0005 (« Qui croire ») : le créateur a sa propre clé pour racine ; un nouvel Admin certifie d'office les Admins qu'il croit ; exclure un Admin re-signe d'office ce qu'il avait signé ; une date de signature est au moins une milliseconde après la plus récente déclaration connue sur la même clé.
- **Liste de mots** (`words-fr.ts`) : les 2 048 mots français de BIP-39, repris de [trezor/python-mnemonic](https://github.com/trezor/python-mnemonic) (`src/mnemonic/wordlist/french.txt`), licence MIT (© 2013-2016 Pavol Rusnak, notice recopiée en tête du fichier), mis en NFC. Mots de 5 à 8 lettres, sans deux mots aux quatre mêmes premières lettres, même sans accents. Cinq mots tirés par `randombytes_uniform` (générateur cryptographique, sans biais) : 5 × 11 = **55 bits**. Avec Argon2id à 64 Mio, essayer la moitié des phrases demande de l'ordre de 2⁵⁴ dérivations, hors de portée de qui volerait la base.
- **Argon2id** : `opslimit = 3`, `memlimit = 64 Mio`, justifiés dans l'ADR 0005. La dérivation bloque le fil où elle tourne (environ une seconde sur téléphone) : l'interface la lancera dans un Web Worker ou derrière un indicateur d'attente. Non mesuré sur un vrai téléphone.
- **Saisie** : le champ de la phrase coupe la majuscule automatique (`autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`) : la casse compte, les espaces en trop et la forme Unicode des accents non.
- **Jamais dans le script léger de l'extension** (ADR 0007) : ESLint (`eslint.config.js`) interdit d'importer `@optizzz/crypto` ou libsodium, même par `import()`, partout dans `apps/extension/src` sauf `entrypoints/background.ts` et les pages de l'extension (dossiers d'`entrypoints/` qui ne sont pas des `.content`), ainsi que dans `packages/game` et `packages/map`. `packages/crypto/src/extension-guard.test.ts` vérifie que la règle se déclenche bien là où il faut.
- **Clés signées** (ticket 15b) : une boîte scellée est anonyme ; sans signature, qui écrit dans la base pourrait glisser à un membre une Clé d'alliance qu'il connaît. Chaque Clé d'alliance scellée porte donc la signature de l'Admin qui l'a scellée (format 2). Les tests jouent les attaques : clé non signée (format 1 ou signature vide), signée par une clé hors de la liste, signature rejouée dans un autre espace, pour une autre version ou pour un autre destinataire, clé remplacée sous une signature valable.
- **Limite connue** : la signature ne prouve pas qu'une version est la dernière ; le site peut cacher la plus récente à un membre. À trancher au cadrage des Envois (19).

## Ce que garde le site

Tout ce qui suit vit dans le schéma Postgres `accounts`, que le site de production écrit avec le rôle `optizzz_app` et que le rôle en lecture seule `optizzz_read` ne voit pas (ADR 0008). E-mail, sessions, hachages des jetons d'extension, Joueurs (serveur, id, pseudo, date de déclaration), clé publique et clé privée chiffrée (avec les paramètres d'Argon2id), espaces (serveur, tag, nom), appartenances (Joueur, rôle, date), Clés d'alliance scellées (une par membre et par version), demandes à rejoindre. Jamais la Phrase de chiffrement, jamais une clé en clair.

## Comptes Optizzz : réalisation (ticket 14)

Décisions prises en codant :

- **Le lien de l'e-mail mène à `/login/confirm`**, où un clic sur « Se connecter à Optizzz » consomme le jeton : un antivirus de messagerie qui ouvre les liens ne le brûle pas. Better Auth répond `INVALID_TOKEN` pour un lien inconnu, déjà servi ou passé ses 15 minutes : `/login` dit les deux à la fois.
- **L'adresse du lien ne vient jamais de la requête** (un en-tête Host forgé enverrait le lien d'un autre vers un domaine tiers) : `src/server/site-origin.ts` la tire de `BETTER_AUTH_URL`, obligatoire en production hors aperçus ; d'un aperçu Vercel, de `VERCEL_URL` ; en dev, de `http://localhost:$PORT`. Better Auth reçoit la même adresse en `baseURL` et ne lit alors plus l'origine de la requête. Test : `src/server/auth-config.test.ts`.
- **Le site ne garde qu'une empreinte du jeton** (`storeToken: "hashed"`), ni adresse IP ni navigateur dans les sessions (crochet `databaseHooks.session.create`). Le champ `name` de Better Auth reste vide.
- **Session** : 30 jours, prolongée au plus une fois par jour, par la question « suis-je connecté ? » que pose l'en-tête depuis le navigateur. Les pages publiques restent statiques, et sans `Set-Cookie` pour qui n'a pas de session.
- **Supprimer son compte** demande une connexion de moins d'un jour (`freshAge` par défaut de Better Auth) : sinon « Reconnectez-vous par un nouveau lien ». Le blocage du dernier Admin d'un espace se branchera dans `src/server/account-deletion.ts` (`deletionChecks`) au ticket 16 ; tout ce qui appartient au compte part par les cascades de `User`.
- **E-mails** : `createEmailSender` envoie par l'API transactionnelle de Brevo quand `BREVO_API_KEY` et `EMAIL_FROM` sont posées ; sinon, hors production, l'e-mail s'écrit dans la console du serveur, et en production l'envoi est refusé (un lien dans les journaux ouvrirait le compte). L'appel à Brevo n'est testé qu'avec un `fetch` simulé.
- **Limite de demandes** : celle de Better Auth (5 par minute sur le lien magique), en mémoire, donc par instance sur Vercel.
- **Aperçus Vercel** (rôle `optizzz_read`) : « La connexion n'est pas disponible ici. Réessayez plus tard. »

| Fichier                                                                                                           | Rôle                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/web/prisma/schema.prisma` (schéma `accounts`)                                                               | Comptes, sessions, liens en attente                               |
| `apps/web/src/server/auth.ts`, `auth-config.ts` (+ test), `site-origin.ts` (+ test), `src/app/api/auth/[...all]/` | Better Auth : lien magique, sessions, suppression                 |
| `apps/web/src/server/account-deletion.ts` (+ test)                                                                | Ce qui peut bloquer une suppression (crochet du ticket 16)        |
| `apps/web/src/server/email/` (+ tests)                                                                            | L'e-mail du lien et son envoi (Brevo ou console)                  |
| `apps/web/src/lib/login-links.ts` (+ test), `src/lib/auth-client.ts`                                              | Adresses du lien, messages d'erreur ; Better Auth côté navigateur |
| `apps/web/src/app/login/`, `src/app/account/`                                                                     | Pages `/login`, `/login/confirm`, `/account`                      |
| `apps/web/src/components/account-link.tsx`                                                                        | « Se connecter » / « Mon compte » dans l'en-tête                  |

Vérifié en local le 2026-10-24, avec les rôles `optizzz_app` et `optizzz_read` créés dans la base Docker : inscription, lien dans la console, connexion, lien réutilisé et lien expiré refusés, prolongation une fois par jour, « Se déconnecter », « Se déconnecter partout » (toutes les sessions effacées), suppression (compte et sessions effacés ; refusée après un jour de connexion), aucun `Set-Cookie` sur les pages publiques sans session, connexion refusée proprement avec `optizzz_read` ; en clair, sombre et à 375 px.

## Joueurs et extension : réalisation (ticket 16)

Décisions prises en codant :

- **Le parcours** : « Connecter mon Compte Optizzz » (en tête de « Fonctionnalités », popup et fenêtre du jeu) ouvre une page de l'extension (`connect-account.html`) qui dit ce qui partira vers optizzz.fr, puis, au clic sur son bouton du même nom, demande la permission (une page de l'extension, parce qu'un script du jeu ne peut pas la demander et que la popup de Firefox se ferme pendant la demande ; c'est aussi la « divulgation bien visible » que le Chrome Web Store exige avant d'envoyer des données). Accordée, la page enregistre le script de liaison, note l'heure de la demande et va sur `https://optizzz.fr/connect-extension`. Pas connecté au site : la page le dit, et après la connexion par lien magique on clique de nouveau « Connecter » (la demande vaut 30 minutes).
- **Permissions facultatives** : `optional_host_permissions: ["https://optizzz.fr/*"]` et `scripting` dans `optional_permissions`, demandées ensemble. Le script de liaison n'est pas dans le manifest (un `content_scripts` sur optizzz.fr serait une permission d'hôte obligatoire, qui désactiverait l'extension à la mise à jour) : le background l'enregistre par `scripting.registerContentScripts` tant que la permission est là (`link-script.ts`), seulement sur `/connect-extension`. Manifest vérifié pour Chrome et Firefox : `permissions` et `host_permissions` inchangés.
- **Le jeton ne passe jamais par la page** : le script de liaison tourne dans le monde isolé de l'extension. Il demande au background s'il y a une demande de liaison en cours (sinon il ne fait rien et la page dit « L'extension n'a pas demandé à être liée »), fait lui-même `POST /api/extension/link` (même origine, avec la session du site), et passe le jeton au background. La page n'apprend que l'état (`data-optizzz-link` sur `<html>` : `linking`, `linked`, `not-requested`, `failed`). Le background n'accepte le jeton que d'un script de l'extension dont l'onglet est sur `https://optizzz.fr/connect-extension`, et seulement pendant une demande ; il ne le donne à personne. Les scripts de l'extension sur le jeu ne le lisent jamais : tout appel au site part du background.
- **`/api/extension/link`** n'accepte qu'une requête JSON de même origine (Origin du site, ou à défaut `Sec-Fetch-Site: same-origin`) avec une session : un autre site ne peut pas en faire créer. Les autres routes (`/api/extension/account`, `/players`, `/token`) ne prennent que le jeton (`Authorization: Bearer`), dont le site compare le SHA-256 ; le cookie de session n'y ouvre rien, et aucune n'envoie d'en-tête CORS : aucune page ne lit leurs réponses. Un jeton est 32 octets aléatoires ; un hachage lent n'apporterait rien.
- **Un jeton par navigateur** : lier de nouveau retire l'ancien jeton du site. « Déconnecter » le retire du site, puis l'oublie ; si le site ne répond pas, l'extension l'oublie quand même et dit de le retirer depuis « Mon compte ». Un jeton retiré depuis `/account` est remarqué à la prochaine ouverture des paramètres (réponse 401) et oublié.
- **L'id du Joueur vient du site** : l'extension envoie le serveur et le pseudo de l'en-tête ; le site cherche l'id dans sa copie de l'export public (`public.Player`). Un pseudo absent de l'export (nouveau joueur, export pas encore relu) est refusé : « … n'est pas encore dans l'export public du serveur… ». L'extension n'a pas à télécharger l'export pour ça, et l'id est toujours un id de l'export.
- **Un Joueur, un compte** : clé primaire `(server, playerId)` de `accounts.declared_player` ; deux déclarations simultanées : la base en refuse une (testé sur Postgres). Message : « Pseudo (S5) est déjà rattaché à un autre Compte Optizzz ; contactez-nous. »
- **L'offre** « Rattacher Pseudo (S5) à votre Compte Optizzz ? » (« Rattacher », « Non merci ») : pour le serveur de la page du jeu (fenêtre du jeu) ou du dernier onglet du jeu (popup). Le background prend le pseudo dans son stockage, jamais dans le message ; un clic que fabriquerait un script de la page (`isTrusted` faux) est ignoré. Un refus est gardé dans `storage.local` (« s5:Pseudo »), même après « Déconnecter ».
- **Interrupteur** « Compte Optizzz » dans « Fonctionnalités » (`catalog.ts`) : coupé, le bloc disparaît et `collect` ne garde ni le pseudo ni la page Membres. Une extension liée le reste.
- **Page Membres** : `collect` garde, sans requête, la dernière liste des membres lue sur `alliance.php?Membres` (pseudos, tag, date ; `src/data/alliance-members.ts`). Rien n'en part au site à ce ticket.
- **Rien sur minuterie** : le background ne parle au site qu'à l'ouverture des paramètres (relire les Joueurs du compte) et sur un clic ; il ne lit jamais le jeu pour le site.
- **Firefox, `data_collection_permissions`** : `required: ["none"]` reste (sans compte, rien ne part) ; `optional: ["authenticationInfo", "websiteContent"]`, demandées avec la permission d'hôte au clic. `authenticationInfo` : Mozilla y range « registration information for account-based extensions » ; le jeton est l'inscription de l'extension au compte, et le pseudo est aussi l'identifiant de connexion au jeu. `websiteContent` : le pseudo est lu dans la page du jeu. Pas `personallyIdentifyingInfo` (nom, adresse, e-mail : l'e-mail est saisi sur le site, pas envoyé par l'extension) ni `browsingActivity` (le serveur fait partie de l'identité du Joueur, pas d'un historique de visite). Le background ne parle au site que si Firefox a ce consentement.
- **Suppression du compte** : jetons et Joueurs partent en cascade avec `User` ; `deletionChecks` ne change pas (les espaces n'existent pas encore).

| Fichier                                                                          | Rôle                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/prisma/schema.prisma` (`ExtensionToken`, `DeclaredPlayer`)             | Jetons hachés et Joueurs, schéma `accounts`                      |
| `apps/web/src/server/extension/` (+ tests, dont un sur Postgres)                 | API de l'extension, jetons, magasin Prisma                       |
| `apps/web/src/app/api/extension/`                                                | Routes `link`, `account`, `players`, `token`                     |
| `apps/web/src/app/connect-extension/`, `src/app/account/`                        | Page « Connecter l'extension » ; Joueurs et extensions liées     |
| `packages/game/src/site-links/extension-link.ts`                                 | Adresses et état de liaison partagés par le site et l'extension  |
| `apps/extension/src/features/optizzz-account/` (+ tests)                         | Background, offre, bloc « Compte Optizzz », permissions, liaison |
| `apps/extension/src/entrypoints/connect-account/`, `entrypoints/optizzz-link.ts` | Page qui demande la permission ; script de liaison               |
| `apps/extension/src/data/optizzz-account.ts`, `data/alliance-members.ts`         | Jeton, Joueurs, refus, pseudo courant ; dernière page Membres    |

Vérifié en local le 2026-10-24 (base Docker, site sur un port de dev) : liaison refusée d'une autre origine et sans session, jeton créé sans `Set-Cookie` ni en-tête CORS, le cookie de session refusé par l'API, Joueur rattaché (201, puis 200), refusé à un second compte (409), pseudo hors export (404), « Déconnecter » (204, puis 401), « Retirer » sur `/account`, suppression du compte (jetons et Joueurs effacés) ; `/account` et `/connect-extension` en clair, sombre et à 375 px. L'extension n'a pas été essayée dans un navigateur (pas de navigateur où la charger) : son parcours est couvert par les tests (`fakeBrowser`).
