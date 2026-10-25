# Envois et leurs vues (étape 4)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-25 (ticket 19). Étape 4 de `site-optizzz.md`, après les Espaces d'alliance (`site-comptes-espaces.md`). Vocabulaire : `GLOSSARY.md` ; décisions de fond : ADR 0005 ; règlement du jeu : `../research/reglement.md`.

## La Clé d'alliance dans l'extension

- **Le site la passe à l'extension** : quand l'accès à l'espace est ouvert sur optizzz.fr, la page de l'espace passe à l'extension les versions de la Clé d'alliance, par le pont qui sert déjà à la page Membres (script `optizzz-space`). Jamais la clé privée : l'extension ne tient que la Clé d'alliance, et rien n'est à taper.
- **Durée** : celle du site. Jusqu'à la fermeture du navigateur, ou 30 jours si « Se souvenir sur cet appareil » est coché sur le site. « Se déconnecter » (site ou extension) l'efface.
- **Une version manque** (après une exclusion) : l'extension n'envoie plus et dit « Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi ».
- **Où l'on chiffre** : dans le fond de l'extension (ou une de ses pages), jamais dans le script léger (garde ESLint de libsodium). Les scripts du jeu demandent au fond ce qu'ils affichent, déjà déchiffré.

## Ce que contient un Envoi

- **À l'intérieur du chiffré** : le Joueur, le Serveur, la catégorie et l'heure du relevé. Celui qui lit rejette un Envoi dont l'intérieur ne correspond pas à la ligne où le site l'a rangé, et garde le plus récent : le site ne peut ni recopier l'Envoi d'un membre sous le nom d'un autre, ni faire passer un vieil Envoi pour neuf. Pas de signature (l'extension n'a pas la clé privée) : un membre pourrait fabriquer l'Envoi d'un autre, ce qu'on accepte entre membres.
- **Version de la clé** : on chiffre avec la plus haute version connue. Navigateur et extension retiennent la plus haute version vue et refusent d'en utiliser une plus basse (ADR 0005, « Une version cachée »).

## Catégories et réglages

- **Où** : dans l'extension, partie « Compte Optizzz » de « Fonctionnalités », **par Joueur** (un pseudo sur S2 et un autre sur S5 se règlent à part). Toutes décochées par défaut, chacune avec une phrase simple qui dit ce qui part (« Vos convois envoyés, reçus et en route »).
- **Six catégories** :
  - **Production** : TDC, ouvrières, taxe prélevée, chasses qui rapportent (page Ressources), colonisateur et ce qu'on lui verse, colonies et ce qu'elles rapportent (page Colonies, lue désormais par `collect` et relue à l'ouverture d'une page comme les autres) ;
  - **Convois** : ses convois en route (page Commerce), l'historique envoyés et reçus (messagerie), et les convois en route vers soi (page Commerce, nouvelle lecture de `collect`, sans requête de plus). Un même convoi vu par celui qui l'envoie et par celui qui le reçoit ne compte qu'une fois ;
  - **Floods** : chaque attaque en route de la liste « Attaque(s) en cours » de la page Armée, avec sa cible et son arrivée ; pour celles du Plan de flood, aussi la prise attendue et l'armée envoyée ;
  - **Chasses** : en cours, retour et gain ;
  - **Armée** : Rien, Nombre ou Par unité (comme « Mon état ») ;
  - **Niveaux et chantiers**.
- **Retirée : « Attaques reçues ».** Le jeu ne montre nulle part les attaques en route vers soi, et aucun rapport de défense n'a été vu (`alertes.md`, `../research/fourmizzz-pages.md`). À revoir si une source apparaît. Les floods des membres sur d'autres membres se voient quand même (« Floods en route vers l'alliance »).
- La page de l'espace montre ce que chaque membre envoie (« Envoie : convois, floods »), sans pouvoir le changer.

## Quand part un Envoi

- Quand ce que l'extension garde pour une catégorie cochée change, l'Envoi part quelques secondes après, avec l'état complet de la catégorie.
- Les relectures en arrière-plan déclenchées par l'ouverture d'une page du jeu (données de plus de 15 minutes, par exemple) comptent comme une action du joueur, comme aujourd'hui.
- Cocher une catégorie envoie tout de suite ce que l'extension sait déjà.
- **Jamais** d'Envoi depuis une minuterie, ni de lecture du jeu faite pour le site (`../research/reglement.md` : l'extension synchronise ce que montre la page affichée).

## Relève

Toutes les 5 minutes et à l'ouverture d'une page du jeu, l'extension relève le site (jamais le jeu), seulement si elle est liée, que le Joueur est dans un espace et qu'elle a la Clé d'alliance. Elle ne demande que ce qui a changé depuis la dernière relève.

## Qui voit quoi

- **Tous les membres voient tout** : Production, Solde, Priorité, Demandes, niveaux, chasses, floods (cible, arrivée, prise attendue), convois, armée en Nombre.
- **Sans condition** : un membre qui n'envoie rien voit ce que les autres envoient. Seule exigence déjà décidée : faire une Demande demande d'envoyer Production et Convois.
- **Réservé aux Admins : la composition exacte des armées** (l'Armée « Par unité » et l'armée envoyée de chaque flood). Ces détails voyagent dans un chiffré à part que le site ne renvoie qu'aux Admins. C'est réservé **par le site, pas par le chiffrement** : tous les membres ont la même Clé d'alliance, et quelqu'un qui tiendrait le site pourrait passer ce chiffré à un membre. Écrit tel quel dans `PRIVACY.md`. Une seconde clé réservée aux Admins reste possible plus tard si le besoin se confirme.

## Vues

- **Sur le site**, la page de l'espace gagne trois onglets :
  - **Floods** : par cible, avec qui, combien et l'arrivée ;
  - **Convois** : dans les deux sens, par membre, filtrables ;
  - **État** : l'ancien « Partage », fusionné ; les unités n'apparaissent qu'aux Admins.
- **Dans le jeu**, aux endroits qui existent déjà :
  - **page Armée**, sous « Attaque(s) en cours », un encart « Floods en route vers l'alliance » : d'abord ceux qui vous visent (« Pseudo, arrivée aujourd'hui 18 h 12, prise attendue 12 348 »), puis ceux qui visent les autres membres, par cible ; note : « Seuls les floods des membres qui les envoient à Optizzz apparaissent ici » ;
  - **page Commerce** : les convois de l'alliance en route vers vous ;
  - **Plan de flood et Cibles** : « déjà visée par Pseudo, arrivée 18 h 12 » ;
  - **vue « Partage »** : fusionne Envois et copier-coller, le relevé le plus récent l'emportant ; les unités pour les Admins seulement.

## Notifications

Deux, décochées par défaut, dans le système d'alertes existant (`alertes.md`) : « Un convoi de Pseudo vous arrive à 18 h 12 » et « Pseudo vous floode : arrivée aujourd'hui 18 h 12 ». Le reste passera par Discord (étape 6).

## Ce que garde le site

- **États** (Production, Chasses, Armée, Niveaux et chantiers) : une ligne chiffrée par Joueur et par catégorie, avec le dernier relevé et le précédent ; l'armée par unité dans une ligne à part, réservée aux Admins.
- **Listes** (Convois, Floods) : une ligne chiffrée par élément, avec en clair seulement l'heure qui sert à l'effacer. L'armée détaillée d'un flood dans un chiffré à part, réservé aux Admins.
- **Doublons** : une empreinte tirée de la Clé d'alliance reconnaît le même convoi ou le même flood ; le site ne voit ni la cible, ni le destinataire, ni les quantités.
- **Conservation** (`site-optizzz.md`) : convois 90 jours ; floods et chasses jusqu'à l'arrivée plus 7 jours ; états, le dernier et le précédent. Supprimer son compte efface ses Envois.

## Le circuit et les Convois : réalisation (ticket 20)

Décisions prises en codant :

- **La Clé d'alliance passe par le pont des espaces.** Quand la page d'un espace ouvre l'accès, elle poste `optizzz:alliance-keys` (`packages/game/src/site-links/space-bridge.ts`) avec toutes les versions qu'elle a ouvertes (32 octets en base64url) et leur durée : `expiresAt` de la clé ouverte avec « Se souvenir sur cet appareil » (`keyKeptUntil`, `src/lib/spaces/key-session.ts`), ou `null` pour la session. Le script `optizzz-space.js` la passe au background, qui ne la prend que de lui (onglet sur `optizzz.fr/spaces/…` ou `/account`). Le background la garde dans `storage.session` (effacé à la fermeture du navigateur, illisible des scripts du jeu) ou jusqu'à sa date dans `storage.local`. La page attend que le script ait marqué `<html>` (10 s au plus) avant de poster.
- **« Se déconnecter » sur le site** : `/account` poste `optizzz:forget-keys` ; le même script tourne donc aussi sur `/account` (et `/account?…`). Une extension liée avant ce ticket voit ses scripts mis à jour au démarrage (`updateContentScripts` quand les pages d'un script ont changé, `link-script.ts`). « Déconnecter » dans l'extension, un jeton retiré (401) ou la suppression du compte l'effacent aussi, avec ce que la relève avait déchiffré.
- **La plus haute version vue** : l'extension la retient par espace (`local:optizzzAccount:keyVersions`, gardée même après « Se déconnecter »), d'après les clés reçues et la version que le site annonce (`/api/extension/spaces`). Des clés plus basses sont refusées ; sans la plus haute, rien ne part et « Compte Optizzz » dit « Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi. » Dès que la page de l'espace remet la version qui manquait, ce qui attendait part. Le site, lui, refuse un Envoi chiffré avec une autre version que la plus haute de l'espace (version lue en clair dans les octets 1–4 du chiffré). La page de l'espace retient de même la plus haute version vue sur l'appareil (`src/lib/spaces/key-versions.ts`) : plus basse, elle le dit et ne passe rien à l'extension.
- **Où l'on chiffre** : dans le background. `entrypoints/background.ts`, seul fichier du background que la garde ESLint laisse importer `@optizzz/crypto`, lie libsodium aux versions d'un espace et le passe à `features/optizzz-account/envois.ts` (`EnvoiCrypto`). Le WebAssembly de libsodium demande `'wasm-unsafe-eval'` (ADR 0007). Pas de document hors écran : le service worker de Chrome et la page de fond de Firefox chargent libsodium comme une page de l'extension.
- **L'Envoi** (`packages/game/src/site-links/envois.ts`) : l'intérieur chiffré `{ v: 1, server, playerId, category, fingerprint, observedAt, item }`. `openEnvoi` refuse un Envoi dont l'intérieur ne nomme pas sa ligne (Joueur, Serveur, catégorie, empreinte) ; `newestPerFingerprint` garde le relevé le plus récent d'un même élément ; la relève de l'extension ne remplace pas une ligne par un relevé plus ancien.
- **Les convois** (`packages/game/src/site-links/envoi-convoys.ts`) : un élément par convoi, `transit` (en route, Commerce, dans les deux sens) ou `delivered` (en-têtes « Convoi livré à X » / « Convoi reçu de X » de la messagerie), avec l'expéditeur, le destinataire, les quantités et l'arrivée. **L'empreinte** (ADR 0005, « Empreinte d'une donnée d'alliance ») est tirée d'une identité commune aux deux joueurs : pour une livraison, la minute que le jeu écrit dans les deux messageries ; pour un convoi en route, pas l'heure (chacun la compte depuis son horloge), mais le rang parmi les convois identiques entre les deux mêmes joueurs, dans l'ordre d'arrivée. Limites : une conversation que le jeu regrouperait autrement chez l'un et chez l'autre compte deux fois ; deux convois identiques vus à des moments différents peuvent un instant compter deux fois.
- **Ce que garde le site** (migration `…_envois`) : `accounts.envoi_item`, une ligne par Joueur, catégorie et empreinte (`blob` chiffré, version de la clé, `expiresAt` = arrivée + 90 jours, borné à 100 jours, `updatedAt` pour la relève) ; `accounts.envoi_settings`, les catégories de chaque Joueur ; `alliance_key_version.createdByPseudo`, pour « Accès changé le … par Pseudo (version N) » (vide pour les versions d'avant). Les lignes pendent au Joueur déclaré (supprimer son compte les efface) et à l'espace (le supprimer les efface) ; quitter l'espace ou en être exclu les laisse à l'alliance jusqu'à leur date. Les lignes passées sont effacées à chaque Envoi de l'espace et jamais servies. Un même convoi rapporté par ses deux joueurs fait deux lignes de même empreinte : les lecteurs le comptent une fois. Le site voit ainsi que ces deux Joueurs ont un convoi en commun, pas lequel.
- **API de l'extension** (jeton seul, sans CORS) : `GET /api/extension/spaces` (Joueurs du compte, leur espace, sa plus haute version, ce que chaque membre envoie), `PUT /api/extension/envoi-settings`, `POST /api/extension/envois` (`{ server, playerId, category, keyVersion, items: [{ fingerprint, blob, expiresAt }], removed }`), `GET /api/extension/envois?space=…&since=…` (lignes écrites depuis le curseur, et `live`, les ids encore là). Refus : catégorie décochée (409 `category-off`, rien n'est gardé), version plus basse (409 `stale-key`), Joueur d'un autre compte (403), hors d'un espace (404). Une ligne n'est réécrite que si son chiffré change : l'extension renvoie le même chiffré pour un convoi qui n'a pas bougé, la relève des autres n'apporte donc que du neuf. La page de l'espace lit la même chose par tRPC (`envois.space`), membres seulement.
- **Quand part l'Envoi** : `storage.onChanged` sur `convoys:`, `incomingConvoys:` et `convoy-history:` d'un serveur, puis 5 s d'attente (plusieurs écritures d'une même page font un seul Envoi), pour le Joueur connecté au jeu sur ce serveur s'il est rattaché et a coché « Convois ». Tout de suite quand on coche. Après un échec (site injoignable), à la prochaine page du jeu ; l'alarme de la relève n'envoie jamais rien. L'Envoi porte tout ce que l'extension garde, et les empreintes disparues depuis le précédent (un convoi arrivé) ; une livraison sortie des 30 jours que garde l'extension reste sur le site jusqu'à sa date. Des données lues pour un autre pseudo que le Joueur (deux comptes dans le même navigateur) ne partent pas.
- **collect** garde les convois en route vers soi (`local:incomingConvoys:<host>`, `readIncomingConvoys`) sur `commerce.php`, sans requête, quand le Joueur de la page a coché « Convois » ; ses convois envoyés et la messagerie aussi, même si les options du Calculateur de convoi sont coupées. La relecture de `commerce.php` en arrière-plan (ouverture d'une page du jeu) les garde de même.
- **Relève** : alarme `optizzz-releve` toutes les 5 minutes, et un message `page-open` de chaque page du jeu (au plus une relecture de `/spaces` par minute). Rien sans lien, sans espace ou sans clé ; seulement le site. Ce qui est déchiffré reste dans `storage.session`.
- **Réglages** : « Compte Optizzz » montre, par Joueur rattaché, « Envois de Pseudo (S5) » et les six catégories avec leur phrase, toutes décochées. Seule « Convois » se coche ; les cinq autres sont grisées « (bientôt) », pour montrer d'emblée ce qui viendra et garder une seule liste (21 et 22 n'auront qu'à les activer). Dessous : l'espace et le dernier envoi, ou ce qui l'empêche. Cocher envoie au site la liste des catégories (« Envoie : convois » sur la page de l'espace).
- **Vues** : onglets « Espace » et « Convois » sur la page d'un espace ; Convois : « Tous », « En route », « Livrés », un membre (envoyés ou reçus), un total ; l'état est écrit en mot. Un convoi en route dont l'arrivée est passée n'est plus montré : il revient en « Livré » quand l'un des deux a ouvert sa messagerie. Dans le jeu, sur `commerce.php`, l'encart « Convois de l'alliance en route vers vous » (ou « Ouvrez votre espace sur optizzz.fr… » sans la clé ; rien hors d'un espace). Notification « S5 : un convoi de Pseudo vous arrive à 18 h 12 » (`alliance-convoy`, décochée, onglet « Notifications » › « Espace d'alliance »), pour un convoi vu pour la première fois à une relève (pas à la première après l'ouverture du navigateur), une fois.
- **Firefox** : le consentement facultatif `websiteContent` déjà demandé couvre les Envois (contenu lu dans les pages du jeu) ; `data_collection_permissions` ne change pas.

| Fichier                                                                                                         | Rôle                                                                 |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/crypto/src/data-fingerprint.ts` (+ test)                                                              | Empreinte d'une donnée, clé de l'alliance                            |
| `packages/game/src/site-links/envois.ts`, `envoi-convoys.ts` (+ tests)                                          | Catégories, enveloppe, convois, identité commune                     |
| `packages/game/src/site-links/space-bridge.ts`                                                                  | `optizzz:alliance-keys`, `optizzz:forget-keys`                       |
| `apps/web/prisma/schema.prisma`, migration `…_envois`                                                           | `envoi_item`, `envoi_settings`, `createdByPseudo`                    |
| `apps/web/src/server/envois/` (+ tests, dont Postgres)                                                          | Règles, magasins, routes de l'extension                              |
| `apps/web/src/lib/envois/convoys.ts` (+ test), `src/components/spaces/convoys-panel.tsx`, `use-space-envois.ts` | Ouvrir, filtrer, onglet « Convois », remise de la clé                |
| `apps/extension/src/features/optizzz-account/envois.ts` (+ test)                                                | Envoi, clé, relève, convois vers soi                                 |
| `apps/extension/src/data/envois.ts`, `data/convoys.ts`                                                          | Choix, clé, versions, relève ; convois en route vers soi             |
| `apps/extension/src/features/optizzz-account/alliance-convoys.ts` (+ test), `section.ts`                        | Encart de `commerce.php`, relève à l'ouverture d'une page ; réglages |

Vérifié en local le 2026-10-25 (base Docker `optizzz_t20`, site sur le port 3020, un compte de test, Joueurs de l'export et jeton d'extension posés à la main en base) : création d'un espace, Clé d'alliance remise par la page au pont (`expiresAt` nul, session), un Envoi de convois fait comme le background (refusé tant que « Convois » n'est pas coché, accepté ensuite, seulement du chiffré en base), « Accès créé le … par Messor (version 1) », « Envoie : convois », onglet « Convois » (deux en route, deux livrés, total) ; en clair, sombre et à 375 px. Pas essayé : la vraie extension dans un navigateur (pas de navigateur où la charger ; son parcours est couvert par les tests, avec un chiffrement de remplacement, le vrai libsodium étant testé dans `@optizzz/crypto` et côté site), donc ni le WebAssembly dans le service worker de Chrome et la page de fond de Firefox, ni la notification, ni l'encart de `commerce.php` dans le jeu.

## Tickets

20 (le circuit et les Convois), 21 (Floods et « floods sur nous »), 22 (Chasses, Armée, Niveaux, Production, Partage fusionné), puis les Demandes (23, 24) et Discord (25, 26).
