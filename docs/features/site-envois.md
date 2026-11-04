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
  - **Mouvements** (ajouté en novembre 2026) : toutes les arrivées du jour, heure par heure, floods, convois et chasses mêlés (`site-mouvements.md`).
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
- **Réglages** : « Compte Optizzz » montre, par Joueur rattaché, « Envois de Pseudo (S5) » et les six catégories avec leur phrase, toutes décochées. Seule « Convois » se coche (et « Floods » depuis le ticket 21) ; les autres sont grisées « (bientôt) », pour montrer d'emblée ce qui viendra et garder une seule liste (21 et 22 n'auront qu'à les activer). Dessous : l'espace et le dernier envoi, ou ce qui l'empêche. Cocher envoie au site la liste des catégories (« Envoie : convois » sur la page de l'espace).
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

## Les Floods : réalisation (ticket 21)

Décisions prises en codant, sur le circuit du ticket 20 :

- **Ce qui part** (`packages/game/src/site-links/envoi-floods.ts`) : un élément par attaque de la liste « Attaque(s) en cours », `{ from, target, at, take }` ; `take`, la prise attendue, seulement pour une attaque du Plan de flood (`null` sinon). L'armée envoyée, `{ army: { JSN: 12000, … } }`, part dans un **second chiffré** de la même ligne (le « chiffré des Admins »), scellé avec la même enveloppe (Joueur, Serveur, catégorie, empreinte) : il ne peut pas passer sous un autre flood sans être refusé. Seul celui qui envoie une attaque la voit : pas de doublon entre membres.
- **L'identité d'une attaque** : le numéro que le jeu lui donne, `span#attaque_<n>`, le même que `Armee.php?annuler=<n>` (`../research/fourmizzz-pages.md`). Il ne bouge pas d'une lecture à l'autre, contrairement à l'arrivée, recalculée à chaque page depuis le décompte : l'empreinte est tirée de `flood|<serveur>|<n>`.
- **D'où ça vient** : `collect` garde la liste du jeu (`local:sentAttacks:<host>`, `readSentAttacks`) sur `Armee.php` et le formulaire d'attaque, sans requête, seulement quand le Joueur de la page a coché « Floods ». La prise attendue et l'armée viennent des attaques notées par le Plan de flood (`data/launches.ts`, qui note désormais l'armée envoyée), rapprochées cible par cible à l'arrivée la plus proche (`pairLaunches`, partagé avec le rapprochement du plan).
- **Quand part l'Envoi** : comme les convois, 5 s après un changement de `sentAttacks:<host>` ou de `flood:<host>:launches`, catégorie par catégorie (changer les convois n'envoie pas les floods). Une attaque disparue de la liste **avant** son arrivée a été annulée : retirée du site. Une attaque arrivée n'est plus jamais rescellée : ce qui est parti (prise, armée) reste tel quel jusqu'à sa date, même quand le plan a oublié l'attaque.
- **Le circuit devient générique** pour les catégories en liste (`ListCategory` : `convoys`, `floods`, et celles du ticket 22) : ce qui a été envoyé est gardé par Joueur et par catégorie (`lists`), les catégories à renvoyer après un échec aussi (`retry`, relu à la prochaine page du jeu) ; ce que l'extension gardait avant (`items`, `pending`) est relu comme les convois. La relève garde la catégorie de chaque ligne.
- **Le site** (migration `…_envoi_detail`) : `envoi_item.detail`, le chiffré des Admins, facultatif, vérifié comme le premier (format, version de la clé). Une catégorie dit si elle en accepte un (les convois, non) et combien de temps une ligne peut rester au plus : floods 40 jours (7 jours après une arrivée à 30 jours au plus, le plus long trajet que note le plan). Une ligne est réécrite quand l'un des deux chiffrés change. `readEnvois` ne renvoie `detail` qu'à un Admin de l'espace, `null` aux autres : **réservé par le site, pas par le chiffrement**, comme décidé.
- **Vues** :
  - **site**, onglet « Floods » (`components/spaces/floods-panel.tsx`, `lib/envois/floods.ts`) : « En route » (la cible touchée la première en haut) ou « Arrivés » (les 7 derniers jours) ; par cible, un tableau De · Prise attendue · Arrivée (heure de Paris), « — » pour une attaque lancée sans le plan, un total quand il y en a plusieurs (« et plus » si une prise est inconnue) ; la colonne « Armée envoyée » pour les Admins seuls (« 12 000 JSN, 348 SN »). Une armée qui ne nomme pas son flood est laissée de côté ;
  - **jeu**, `Armee.php` (`features/optizzz-account/alliance-floods.ts`) : l'encart « Floods en route vers l'alliance » à la fin du bloc « Attaque(s) en cours » : « Vers vous », puis « Vers les autres membres » par cible, chaque flood en « Pseudo, arrivée aujourd'hui 18 h 12, prise attendue 12 348 », et la note. Les membres : ceux de l'espace, et ceux de la dernière page Membres lue quand son tag est celui de l'espace ;
  - **Plan de flood** : « Déjà visée par Pseudo, arrivée 18 h 12 : sa prise n'est pas comptée dans ce plan. » ; **Cibles**, colonne État : « libre · déjà visée par Pseudo, arrivée 18 h 12 ». Ses propres attaques n'y sont pas (le jeu les liste déjà). Seulement avec « Compte Optizzz » allumé ;
  - **notification** `alliance-flood`, décochée (Notifications › Espace d'alliance, « Flood d'un membre en route vers vous ») : « Pseudo vous floode : arrivée aujourd'hui 18 h 12 (S5) », pour un flood vu pour la première fois à une relève (pas à la première), une fois ; un clic ouvre la page Armée.
- L'extension ne déchiffre jamais l'armée d'un flood (aucune vue du jeu ne la montre) ; le site la lui renvoie quand même si le Joueur est Admin, comme à la page de l'espace.
- **Limites** : un flood arrivé pendant un changement d'accès (nouvelle version de la clé, donc nouvelles empreintes) peut compter deux fois sur le site jusqu'à sa date ; les attaques lancées avant ce ticket n'ont pas d'armée notée ; la prise attendue est celle du plan, jamais celle d'un rapport de combat.

| Fichier                                                                                    | Rôle                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/game/src/site-links/envoi-floods.ts` (+ test)                                    | Éléments, identité, floods vers soi et par cible, textes        |
| `apps/web/prisma/schema.prisma`, migration `…_envoi_detail`                                | `envoi_item.detail`                                             |
| `apps/web/src/server/envois/` (+ tests, dont Postgres)                                     | Catégorie Floods, chiffré des Admins réservé aux Admins         |
| `apps/web/src/lib/envois/floods.ts` (+ test), `src/components/spaces/floods-panel.tsx`     | Ouvrir, grouper par cible, onglet « Floods »                    |
| `apps/extension/src/data/sent-attacks.ts`, `features/flood/attacks.ts` (`readSentAttacks`) | Liste du jeu avec le numéro de chaque attaque                   |
| `apps/extension/src/features/optizzz-account/envois.ts` (+ test), `data/envois.ts`         | Circuit générique des listes, Envoi des floods, relève, réponse |
| `apps/extension/src/features/optizzz-account/alliance-floods.ts` (+ test)                  | Encart de `Armee.php`                                           |
| `apps/extension/src/features/flood/`, `features/targets/`                                  | « Déjà visée par Pseudo »                                       |

Vérifié en local le 2026-10-26 (base Docker `optizzz_t21`) : règles et magasin du site sur Postgres (chiffré des Admins gardé, réécrit, renvoyé à l'Admin seul) ; l'onglet « Floods » rendu avec des floods de démonstration (page temporaire, retirée), en clair, sombre et à 375 px. Pas essayé : un vrai parcours avec l'extension dans un navigateur et le jeu (comme au ticket 20) ; l'encart de `Armee.php`, le « déjà visée » et la notification sont couverts par les tests seulement.

## Les états et « État » : réalisation (ticket 22)

Décisions prises en codant, sur le circuit des tickets 20 et 21 :

- **Une ligne par Joueur et par état** (`packages/game/src/site-links/envoi-states.ts`) : Production, Chasses, Armée, Niveaux et chantiers passent par le circuit des listes, chacun avec un seul élément. Son identité, `state|<serveur>|<catégorie>|<pseudo>`, donne une empreinte propre au Joueur (les lecteurs gardent le plus récent par empreinte). L'intérieur : `{ pseudo, reading, previous }`, le dernier relevé et le précédent avec sa propre heure (`nextStateItem`). Un relevé inchangé ne repart pas (rien n'est posté) ; il est redaté et rescellé au bout de 6 heures (`STATE_REFRESH_MS`), pour que son âge reste vrai chez les autres. Le site efface un état 90 jours sans nouvel Envoi (borné à 100 jours), et **tout de suite quand sa catégorie est décochée** (`forgetStates`, à l'enregistrement des catégories) ; quitter « Par unité » efface le détail par unité.
- **Ce que porte chaque état** :
  - **Production** : TDC et ouvrières (en-tête, n'importe quelle page), ouvrières à la nourriture et aux matériaux, champignonnière et taux de la taxe (Ressources), colonisateur et colonies avec la date de leur prise et ce qu'elles ont rapporté depuis (`colonies.php`, `readColonies` lit désormais « appartient depuis » et « vous a rapporté »). `productionPerDay` en tire la Production de `GLOSSARY.md` : (ouvrières au travail × 48 + champignonnière), moins la taxe (arrondie à l'inférieur), plus ce que rapporte chaque colonie **en moyenne depuis sa prise** (la page ne donne qu'un cumul) ; une colonie prise depuis moins d'une heure, ou `colonies.php` jamais lu, rend la Production « au moins » (« ≥ »). Les chasses qui rapportent sont dans l'état Chasses (gain en TDC), pas dans la Production.
  - **Chasses** : celles encore dehors, leur retour et leur gain.
  - **Armée** : comme « Mon état » : la garnison (Armee.php), plus les troupes en chasse (Compte+), dans les colonies, qui en reviennent, et les fourmis des attaques du Plan de flood ; « incomplète » quand une partie reste inconnue. Le total et le retour dans le chiffré de tous ; le détail par unité, avec « Par unité » seulement, dans le **chiffré des Admins** (`ARMY_UNITS`), que le site refuse sans « Par unité » coché (409 `category-off`, l'extension redit ses choix) et ne renvoie qu'aux Admins.
  - **Niveaux et chantiers** : tous les bâtiments (construction.php) et recherches (laboratoire.php) lus, et leurs chantiers avec leur fin.
- **D'où ça vient** : `collect` garde ce que la page ouverte montre de soi (`local:envoiStates:<host>`, `data/state-pages.ts`), page par page et seulement pour une catégorie cochée par le Joueur de la page, sans requête. **Relectures** (`features/optizzz-account/state-rereads.ts`) : à l'ouverture d'une page du jeu, Ressources et `colonies.php` sont relus quand ce qui en est gardé a plus de 15 minutes, seulement pour Production, Chasses ou Armée cochées ; jamais sur une minuterie. Armee.php, construction.php et laboratoire.php ne sont gardés que quand le joueur les ouvre (ils bougent moins, et le règlement préfère ce que montre la page affichée).
- **Quand part l'Envoi** : comme les listes, 5 s après un changement de `envoiStates:<host>`, chaque état coché pour lui-même ; tout de suite quand on le coche ou qu'on passe de « Nombre » à « Par unité ». Un état n'est jamais une nouvelle pour Discord (ticket 25) : `announceList` ne regarde que convois et floods.
- **Réglages** : les six catégories se cochent ; l'Armée est une liste « Rien », « Nombre », « Par unité ». Plus de « (bientôt) ».
- **Partage fusionné** : le format partagé (`SharedState`) et le texte copié (`share-text.ts`) passent dans `packages/game/src/sharing/` pour servir aussi au site. `mergeMemberStates` fusionne **partie par partie** (TDC, ouvrières, bâtiments, recherches, chantiers, armée, production, chasses) : le relevé le plus récent de chaque partie l'emporte, d'où qu'il vienne, le précédent sert aux flèches ; un même relevé vu deux fois compte une fois. Le relevé d'un membre est daté de sa partie la plus récente.
  - **extension**, vue « Partage » : la relève ouvre les états (le détail par unité seulement s'il est venu, donc pour un Admin) ; la vue les demande au fond (`states`), seulement si le tag de l'espace est celui de l'alliance affichée, et les mêle aux états collés ; un groupe « Production » s'ajoute (Production / jour, récolte, taxe versée, colonies, chasses en cours). Les unités collées depuis Discord restent montrées comme avant (elles étaient déjà sur Discord) ;
  - **site**, onglet « État » (`components/spaces/state-panel.tsx`, `lib/envois/states.ts`) : chaque état est nommé d'après le membre de l'espace qui l'envoie (jamais d'après son contenu), fusionné avec les états collés dans l'onglet (gardés dans l'onglet seulement, jamais envoyés) ; groupes Résumé, Production, Armée (unités pour les Admins seuls, collées comprises), Chasses, Bâtiments, Recherches, Chantiers ; ↑ ↓ sur 24 h, « (ancien) » après 3 jours.
- **Limites** : la Production des colonies est une moyenne depuis leur prise ; l'armée composée de pages lues à des moments différents peut un instant compter deux fois une troupe (une chasse lancée après la dernière lecture d'Armee.php) ; un état arrivé pendant un changement d'accès est remplacé au prochain Envoi.

| Fichier                                                                                                  | Rôle                                                           |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/game/src/site-links/envoi-states.ts` (+ test)                                                  | Relevés, élément, Production, état d'un Envoi                  |
| `packages/game/src/sharing/shared-state.ts`, `share-text.ts` (+ tests)                                   | État partagé, fusion par partie, texte copié                   |
| `packages/game/src/pages/colonies.ts` (+ test)                                                           | Date de prise et rapport des colonies                          |
| `apps/web/src/server/envois/` (+ tests, dont Postgres)                                                   | Catégories d'état, chiffré des Admins, effacement au décochage |
| `apps/web/src/lib/envois/states.ts` (+ test), `src/components/spaces/state-panel.tsx`                    | Ouvrir, fusionner, onglet « État »                             |
| `apps/extension/src/data/state-pages.ts` (+ test), `features/collect/`                                   | Ce que montrent les pages, gardé par serveur                   |
| `apps/extension/src/features/optizzz-account/envoi-states.ts`, `state-rereads.ts`, `envois.ts` (+ tests) | Relevés, relectures à l'ouverture d'une page, circuit, relève  |
| `apps/extension/src/features/alliance-sharing/merge.ts` (+ test), `AllianceSharing.tsx`                  | « Partage » fusionné                                           |
| `apps/extension/src/features/optizzz-account/section.ts`                                                 | Six catégories, Armée « Rien », « Nombre », « Par unité »      |

Vérifié en local le 2026-10-26 (base Docker `optizzz_t22`) : règles et magasin du site sur Postgres (un état par Joueur, effacé au décochage, unités aux Admins seuls) ; l'onglet « État » rendu avec des états de démonstration (page temporaire, retirée), en clair, sombre et à 375 px. Pas essayé : la vraie extension dans un navigateur et le jeu (collect, relectures, vue « Partage » couverts par les tests seulement).

## État : le tableau des membres (chantier 12)

Décidé lors d'une session de cadrage le 2026-11-03 (`plans/lot-2026-11/12-etat-chefs.md`).

- **Le Résumé devient un tableau** : une ligne par membre, des colonnes au choix. Les autres vues de « État » (Production, Armée, Chasses, Bâtiments, Recherches, Chantiers) ne changent pas.
- **Pour tous les membres** : tous voient déjà tout (« Qui voit quoi »). Pas de colonne par unité : la vue Armée les montre déjà aux Admins.
- **Colonnes**, en groupes dans un menu « Colonnes » (cases à cocher) ; « Membre » toujours là :
  - Résumé : Production / jour, TDC, Ouvrières, Armée (total, « incomplète ») ;
  - Recherches et Bâtiments : chacun ;
  - En cours : Prochain chantier, Chasses (nombre et gain), Convois en route, Floods en route ;
  - Envois : Envoie (catégories en mots), Dernier Envoi.
  - **Par défaut** : Production / jour, TDC, Ouvrières, Armée, Armes, Bouclier, Vitesse d'attaque, Dôme, Loge, Prochain chantier, Envoie, Dernier Envoi. Choix gardé dans le navigateur (`localStorage`), le même pour tous les espaces, rien n'est envoyé ; bouton « Colonnes par défaut ».
- **Âge d'un relevé, dans chaque case** : la date de la partie, courte, sous la valeur (« 13 h 36 » aujourd'hui, « hier », « 02/11 »), la date entière au survol ; valeur et date en gris au-delà de 48 h (la date écrite porte l'information, le gris la souligne, ADR 0003). ↑ ↓ sur 24 h comme avant ; plus de colonne « Relevé ». Pour cela, la fusion garde la date de chaque partie (`partsReadAt`). Envoie, Convois et Floods en route ne sont pas datés.
- **Dernier Envoi** : le plus récent des relevés des états du membre et des lectures de ses convois et floods, une fois déchiffrés (le site ne garde aucune date en clair) ; les états collés ne comptent pas. « aucun » s'il n'a rien envoyé, gris au-delà de 48 h. Pas « Dernière activité » : un Envoi part quand le membre ouvre une page du jeu, jamais sur une minuterie, ce que dit la note du tableau.
- **Convois en route** : « ↑ 2 · ↓ 1 », convois en route envoyés par le membre et vers lui ; au survol, ce qui arrive vers lui et la prochaine arrivée. **Floods en route** : « ↑ 3 · ↓ 1 », attaques lancées par le membre (toutes cibles) et attaques de membres qui le visent ; au survol, la prochaine arrivée. « — » quand rien. On ne voit que ce que les membres envoient : un flood venu d'ailleurs n'apparaît pas.
- **Tri** : un clic sur un en-tête trie (décroissant, croissant, puis l'ordre de l'espace), ▼ ▲ et `aria-sort` ; une case vide reste en bas ; le tri n'est pas gardé. Convois triés sur ↓, floods sur ↑.
- **Mobile** : le tableau défile dans sa boîte, « Membre » collé à gauche ; aucune colonne masquée.
- **Réalisation** : le groupe s'appelle « Tableau » et remplace « Résumé » ; les colonnes de Recherches et Bâtiments suivent l'ordre du jeu (Bouclier avant Armes), défaut compris, pour qu'un choix ne déplace rien. Le menu est un `<details>` ; le choix est gardé sous `optizzz:state-columns` (lu par `useSyncExternalStore`, et gardé le temps de la page si le navigateur refuse).

| Fichier                                                              | Rôle                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/game/src/sharing/shared-state.ts` (+ test)                 | `partsReadAt` : la date de chaque partie fusionnée                            |
| `packages/game/src/format/time-format.ts` (+ test)                   | `formatPastTimeShort` : « 13 h 36 », « hier », « 02/11 »                      |
| `packages/game/src/site-links/envois.ts` (+ test)                    | `sentCategoriesText` : « production, convois » ou « rien »                    |
| `apps/web/src/lib/envois/member-table.ts` (+ test)                   | Colonnes, défaut, date et changement d'une case, Dernier Envoi, en route, tri |
| `apps/web/src/components/spaces/member-table.tsx`, `state-panel.tsx` | Le tableau, son menu « Colonnes », dans l'onglet « État »                     |

Vérifié le 2026-11-04 avec des états de démonstration (page temporaire, retirée), en clair, sombre et à 375 px : dates par case, gris après 48 h, colonne « Membre » collée au défilement, menu et choix gardé, tri et `aria-sort`, survols des convois et floods. Pas essayé : des Envois réels d'un espace (le passage des convois, floods et `sends` depuis `member-space.tsx` n'est couvert que par le typage).

## Statistiques des convois

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-01, d'après la maquette « C · Espace d'alliance · Convois (stats) » du canevas « Optizzz — maquettes du site », et réalisé le même jour.

- **Où** : l'onglet « Convois » de l'Espace a un choix « Statistiques | Liste » (la liste est l'onglet d'avant), Statistiques par défaut. La vue, la période et le membre tiennent dans l'adresse (`?vue=liste`, `?periode=7`, `?membre=Noctis`). L'onglet porte le nombre de convois en route quand l'accès est ouvert sur l'appareil, rien sinon.
- **Ce qui compte** : les convois **livrés**, à l'heure de leur livraison, une fois par empreinte, comme le Solde (`soldeOf`). Un convoi en route ne compte pas dans le livré (son arrivée lue dans une messagerie compte à sa place) ; il a sa tuile et son encart.
- **Périodes** : 7, **30** (par défaut, comme la Priorité) ou 90 jours, comptés jusqu'à maintenant. Une période qui commence avant le plus vieux convoi connu le dit : « Convois connus depuis le 12/10 : avant, il peut en manquer. »
- **Qui est membre** : les membres actuels de l'Espace. « Entre membres », « Flux principaux » et « Hors alliance » en dépendent ; un ancien membre compte hors alliance (dit sous « Hors alliance »).
- **Couverture** : un encadré « 14 membres sur 18 envoient leurs convois » nomme ceux qui n'envoient pas « Convois » (d'après ce que chaque membre envoie aujourd'hui) : on ne compte que ce qu'ils échangent avec ceux qui l'envoient. Il disparaît quand tous envoient. Ces membres sont marqués « partiel » dans « Par membre ».
- **Tuiles** : livré (nourriture et matériaux), convois livrés (et moyenne par jour), en route (quantité, arrivée du prochain), part entre membres, et « environ » ce qui est allé aux Demandes (convois rattachés, `demande-convoys`, dont l'arrivée est passée : relevés en route, d'où l'« environ »).
- **Livré par jour** : barres empilées par jour de Paris (par semaine sur 90 jours), matériaux en ambre plein, nourriture en bleu hachuré, légende écrite (ADR 0003) ; le détail au survol. Sous 3 jours de convois, une note à la place, comme les autres graphiques (`site-refonte.md`).
- **Par membre** : Membre · Livré · Reçu · Solde · Convois · Dernier. Le **Solde est reçu − livré**, comme la Priorité, en barre centrée sur zéro avec son signe écrit. Trié par livré, triable par chaque en-tête ; les membres sans convoi sur la période derrière « Afficher (7) » ; sur téléphone, Convois et Dernier masqués.
- **En route** : les 3 prochains convois de l'alliance, lien vers la liste.
- **Flux principaux** : les 8 plus gros échanges entre deux membres (nourriture + matériaux livrés), un sens par ligne (A → B et B → A à part), avec le nombre de convois.
- **Hors alliance** : « Vers d'autres joueurs » et « Depuis d'autres joueurs », le total puis les 3 plus gros avec leur alliance actuelle (« Gargantua [C6P] ») et « N autres ». L'alliance vient de la liste publique joueur → alliance du serveur (export), chargée entière et la même pour tous : **demander au site l'alliance de quelques pseudos lui apprendrait avec qui l'alliance échange**. Sans cette liste, les pseudos seuls.
- **Un membre choisi** : les tuiles deviennent les siennes (livré, reçu, Solde, convois, en route vers lui ou de lui), le graphique montre son livré et son reçu côte à côte, « Par membre » devient « Avec qui » (chaque joueur avec qui il a échangé, membre ou non : livré à, reçu de, Solde), flux et hors alliance se limitent à ses convois.
- **Copier pour Discord** : un bloc Markdown dans le presse-papiers, rien n'est envoyé : « **Convois 4O4 · 30 jours** (du 02/10 au 01/11) », « Livré : 38,4 M (14,1 M nourriture · 24,3 M matériaux) · 412 convois », une ligne par membre triée par livré (« Noctis : livré 7,8 M · reçu 1,1 M · solde −6,7 M »), puis « (Grop, Lasius… n'envoient pas leurs convois) ». Il suit le membre choisi.
- **Calcul** : dans le navigateur seulement, à partir des convois déjà ouverts pour l'onglet ; fonctions pures dans `apps/web/src/lib/envois/convoy-stats.ts` (+ test). Le site n'apprend rien de plus.
- **Où l'on rattache aux Demandes** : `openDemandes` rend aussi les convois rattachés qu'il ouvre déjà ; « Pour les Demandes » les reprend, sans rien déchiffrer de plus.

| Fichier                                                                          | Rôle                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/envois/convoy-stats.ts` (+ test)                               | Tuiles, jours ou semaines, par membre ou « Avec qui », flux, hors alliance, texte pour Discord |
| `apps/web/src/lib/envois/convoy-view.ts` (+ test)                                | Vue, période et membre lus et écrits dans l'adresse                                            |
| `apps/web/src/components/spaces/convoys-panel.tsx`                               | Onglet « Convois » : barre de choix, Statistiques ou Liste, copie                              |
| `apps/web/src/components/spaces/convoy-stats-view.tsx`, `convoy-stats-chart.tsx` | Vue « Statistiques », graphique Recharts                                                       |
| `apps/web/src/components/spaces/use-server-alliances.ts`                         | Alliance de chaque joueur, d'après la carte publique du serveur                                |

Vérifié en local le 2026-11-01 avec une page de démonstration temporaire (convois inventés, retirée) : alliance entière, un membre choisi, 7, 30 et 90 jours (« Convois connus depuis le … »), la liste, l'adresse qui suit les choix ; l'alliance des autres joueurs lue dans la carte locale ; en clair, sombre et à 375 px. Pas essayé : un vrai Espace avec la Clé d'alliance ouverte, ni le collage dans Discord.

## Statistiques des floods

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-01, d'après la maquette « C · Espace d'alliance · Floods (stats) » du canevas « Optizzz — maquettes du site », sur le modèle des Statistiques des convois, et réalisé le même jour.

- **Où** : l'onglet « Floods » a le même choix « Statistiques | Liste » (la liste est l'onglet d'avant), Statistiques par défaut ; vue, période et membre dans l'adresse (`?onglet=floods&vue=liste&periode=24h&membre=Noctis`). L'onglet porte le nombre de floods en route.
- **Périodes** : 24 heures ou **7 jours** (par défaut) : le site efface un flood 7 jours après son arrivée, ce que la page dit toujours. Sur 24 heures, les barres sont par heure, sur 7 jours par jour de Paris.
- **Ce qui compte** : les floods **arrivés** dans la période, un par empreinte ; ceux en route ont leur tuile et leur encart. Un flood annulé n'est déjà plus sur le site.
- **Prise attendue** : celle du Plan de flood, jamais celle du combat ; la somme des prises connues, « ≥ » dès qu'un flood de la période a été lancé sans le Plan (« N floods lancés sans le Plan »), et la part lancée avec le Plan. On n'invente aucune prise.
- **Couverture** : seul celui qui lance un flood l'envoie : un membre qui n'envoie pas « Floods » n'apparaît nulle part. L'encadré « 8 membres sur 10 envoient leurs floods » les nomme ; ils sont en bas de « Par membre » (« n'envoie pas « Floods » »).
- **Blocs** : tuiles (floods arrivés, prise attendue, en route, cibles et celles visées par plusieurs membres, avec le Plan) ; « Prise attendue par jour » (ou par heure), le nombre de floods écrit au-dessus de chaque barre ; « Par membre » (floods, prise attendue, cibles, en route, dernière arrivée ; triable) ; « Cibles les plus visées » (les 8 premières par prise attendue, leur alliance d'après la carte publique du serveur, « N membres » quand plusieurs membres la visent) ; « En route » (les 3 prochains) ; « Armée envoyée ».
- **Armée envoyée** : réservée aux Admins (le site ne la rend qu'à eux) : le total par unité des floods arrivés dans la période, abréviations et ordre du jeu, « sur N floods lancés avec le Plan ».
- **Un membre choisi** : tuiles et graphique deviennent les siens, « Par membre » devient « Ses cibles » (cible, floods, prise attendue, dernière arrivée), « En route » et « Armée envoyée » se limitent à ses floods.
- **Copier pour Discord** : « **Floods 4O4 · 7 jours** (du 26/10 au 01/11) », « 64 floods arrivés · prise attendue ≥ 4,82M (9 sans le Plan) », une ligne par membre (« - Noctis : 14 floods · prise 1,24M · 6 cibles »), « Cibles : … » (les 3 premières), puis ceux qui n'envoient pas. **Jamais l'armée** : réservée aux Admins, un salon Discord est lu par tous.
- **Calcul** : dans le navigateur seulement, d'après les floods déjà ouverts pour l'onglet ; fonctions pures dans `apps/web/src/lib/envois/flood-stats.ts` (+ test).

| Fichier                                                                        | Rôle                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `apps/web/src/lib/envois/flood-stats.ts` (+ test)                              | Tuiles, heures ou jours, par membre, cibles, en route, armée, texte Discord |
| `apps/web/src/lib/envois/flood-view.ts` (+ test)                               | Vue, période et membre lus et écrits dans l'adresse                         |
| `apps/web/src/components/spaces/floods-panel.tsx`                              | Onglet « Floods » : barre de choix, Statistiques ou Liste, copie            |
| `apps/web/src/components/spaces/flood-stats-view.tsx`, `flood-stats-chart.tsx` | Vue « Statistiques », graphique Recharts                                    |

Vérifié en local le 2026-11-01 avec une page de démonstration temporaire (floods inventés, retirée) : alliance entière, 7 jours et 24 heures (barres par heure), un membre choisi (« Ses cibles »), la liste filtrée par membre, l'armée des Admins, l'adresse qui suit les choix, l'alliance des cibles lue dans la carte locale ; en clair, sombre et à 375 px. Pas essayé : un vrai Espace avec la Clé d'alliance ouverte, ni le collage dans Discord.

## Équilibre des ressources

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-03 (chantier 11 du lot de novembre, `plans/lot-2026-11/11-equilibre-ressources.md`). Répond à « qui doit convoyer, qui doit recevoir » sur une période, alliance entière. Vocabulaire : Part et Écart dans `GLOSSARY.md`.

- **Où** : une troisième vue de l'onglet « Convois », « Statistiques | Équilibre | Liste » (`?vue=equilibre`). Périodes 7, **30** (par défaut) ou 90 jours (`?periode=`).
- **Production** : le **plafond**, TDC du jour × 48, jour par jour d'après `PlayerDay` (l'export de la nuit, public). Le site n'a pas de relevé heure par heure : un jour compte ses 48 cycles avec le TDC de la nuit. La Production réelle de l'Envoi n'a pas d'historique : l'appliquer à 30 jours prendrait l'état d'aujourd'hui pour celui d'il y a un mois.
- **Qui partage** : les membres de l'Espace, chaque jour où l'export les met dans l'alliance de l'Espace (un membre arrivé en cours de période n'a de Part qu'à partir de là). Les joueurs de l'alliance hors de l'Espace ne comptent pas : on ne connaît pas leurs convois.
- **Part** : chaque jour, la production de ces membres partagée à parts égales, additionnée sur la période. Ni au prorata du TDC (chacun retomberait sur sa part), ni réglable.
- **Net** : production − taxe de colonie versée + taxes reçues − convois livrés + convois reçus, nourriture et matériaux additionnés. Les convois comptent à leur livraison, une fois par empreinte, comme le Solde, y compris avec des joueurs hors alliance (ce qui sort est perdu pour elle). Une taxe entre deux membres compte dans le net de chacun, une seule fois dans le total de l'alliance. **Taux** : celui de l'Envoi Production du colonisé ; sinon 20 % + 1 % par niveau de l'étable à pucerons du colonisateur quand son Envoi Niveaux la donne ; sinon 20 %, marqué « ≈ ». Qui colonise qui : l'export (`masterId`).
- **Écart** = net − Part ; **ratio** = net / Part ; **verdict** écrit en mot : « Convoyer » (écart positif), « Équilibré » (à ±5 % de la Part, fixe), « Recevoir » (négatif). Un membre qui n'envoie pas « Convois » n'a pas de verdict (« partiel » : on ne voit pas ce qu'il échange hors de l'Espace), mais garde sa Part dans le calcul des autres.
- **Entrepôt estimé** : le stock du dernier Envoi Production (nourriture et matériaux, **nouveau dans l'Envoi**, lu dans l'en-tête comme le TDC), plus le plafond depuis, moins la taxe, moins les convois partis depuis (en route compris), plus ceux arrivés ; borné par la capacité des entrepôts quand l'Envoi Niveaux la donne. Un maximum (« ≤ ») : les dépenses (chantiers, ponte, armée) ne sont pas connues. « — » sans stock de moins de 48 h. Montré en deux lignes, nourriture et matériaux.
- **La vue** : trois tuiles (production de l'alliance, Part moyenne par jour, N à convoyer · N à recevoir), l'encadré de couverture comme les Statistiques (« 14 membres sur 18 envoient leurs convois ») ; un tableau Membre · TDC · Entrepôt estimé · Production · Colonies (taxes ±) · Envoyés · Reçus · Part · Écart · Ratio · Verdict, triable, trié par écart (« Convoyer » en haut) ; à 375 px Membre, Écart et Verdict, le reste en dépliant la ligne ; une note de méthode dépliable : « La Priorité compare ce qu'un membre a reçu à sa propre production ; l'Équilibre compare ce qui lui reste à sa part. »
- **Un membre choisi** (`?membre=`) : sa ligne surlignée et son détail jour par jour (production, Part, convois), simple liste que le chantier 21 remplacera.
- **Copier pour Discord** : « **Équilibre 4O4 · 30 jours** (du … au …) », une ligne par membre (« Noctis : convoyer · écart +6,7M (ratio 1,8) »), puis ceux sans verdict. **Jamais l'entrepôt** : un salon Discord est plus large que l'Espace.
- **Dans l'onglet Demandes** : sous la Priorité de chaque demandeur, une ligne discrète sur 30 jours (la fenêtre du Solde), « Équilibre : recevoir (−2,1M) ». La Priorité reste le classement.
- **Calcul** : dans le navigateur, à partir des Envois déjà ouverts et des TDC jour par jour des membres servis par le site (données publiques) ; fonctions pures dans `apps/web/src/lib/envois/balance.ts` (+ test), reprises par les chantiers 21 et 23.

Réalisé le 2026-11-04. Décisions prises en codant :

- **Le stock part avec la Production** (`packages/game/src/site-links/envoi-states.ts`) : `stock: { food, materials, at }`, lu dans l'en-tête de n'importe quelle page (`data/state-pages.ts`). Il bouge à chaque page : un relevé dont seul le stock a changé ne repart qu'une heure après le dernier stock envoyé (`STOCK_REFRESH_MS`), sans décaler le relevé précédent (les flèches de « État » comparent le reste). Les **capacités des entrepôts** partent avec Niveaux et chantiers (`capacities`, lues sur `construction.php`). Les deux sont facultatives : les Envois d'avant restent lisibles. Elles arrivent dans l'état partagé (`SharedState.stock`, `capacities`).
- **Les TDC jour par jour** : `players.allianceDays` (tRPC, public, comme les courbes d'une fiche joueur) rend, pour les membres de l'Espace et les joueurs qu'ils colonisent, le pseudo du colonisateur et chaque jour (`PlayerDay`) le TDC et l'alliance ; 90 jours lus une fois, quelle que soit la période. Un jour absent de l'export garde le dernier connu ; qui colonise qui est celui d'aujourd'hui, appliqué à toute la période.
- **Aujourd'hui** compte au prorata de l'heure (minuit → maintenant), pour la production comme pour la Part.
- **Entrepôt estimé** : le stock, plus la récolte nette de taxe de l'Envoi Production (nourriture : ouvrières × 48 + champignonnière, matériaux : ouvrières × 48) au prorata du temps, moins les convois de ce membre arrivés ou en route après le relevé, plus ceux livrés à ce membre depuis. Un convoi compte par son arrivée (son départ n'est pas connu) : un convoi parti avant le relevé et arrivé après est retiré deux fois, d'où un entrepôt parfois sous-estimé.
- **Vue** (`components/spaces/balance-view.tsx`, `use-space-balance.ts`) : à 375 px, Membre (avec le verdict dessous), Écart et le bouton de détail ; Production, Envoyés et Reçus à partir de 640 px, Entrepôt, Part et Ratio à partir de 768 px, TDC et Colonies à partir de 1 280 px ; le reste dans le détail déplié. L'écart en barre centrée (ambre à droite, bleu à gauche, signe écrit), le verdict en mot avec une flèche ou « = ».
- **Demandes** : la ligne « Équilibre : … » sous la Priorité, sur 30 jours, lue seulement quand l'onglet a des Demandes.

| Fichier                                                                                        | Rôle                                                                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/web/src/lib/envois/balance.ts` (+ test)                                                  | Part, net, Écart, verdict, Entrepôt estimé, taux de taxe, Discord      |
| `apps/web/src/server/api/routers/players.ts`                                                   | `allianceDays` : TDC et alliance jour par jour, colonies, colonisateur |
| `apps/web/src/components/spaces/balance-view.tsx`, `use-space-balance.ts`, `convoys-panel.tsx` | Vue « Équilibre », lecture des TDC, choix et copie                     |
| `apps/web/src/components/spaces/demandes-panel.tsx`                                            | Ligne sous la Priorité                                                 |
| `packages/game/src/site-links/envoi-states.ts`, `sharing/shared-state.ts` (+ tests)            | Stock et capacités dans les Envois et l'état partagé                   |
| `apps/extension/src/data/state-pages.ts`, `features/optizzz-account/envoi-states.ts` (+ tests) | Stock de l'en-tête, capacités de `construction.php`                    |

Vérifié le 2026-11-04 avec une page de démonstration temporaire (membres et convois inventés, retirée) : un membre arrivé en cours de période, une colonie interne et une hors Espace, un membre sans « Convois », l'entrepôt borné et sans stock, le détail jour par jour ; en clair, sombre et à 375 px. Pas essayé : un vrai Espace avec la Clé d'alliance ouverte et `allianceDays` sur une vraie base, la ligne des Demandes à l'écran, le collage dans Discord, et le stock envoyé par la vraie extension (il ne partira qu'avec sa prochaine version).

## Tickets

20 (le circuit et les Convois), 21 (Floods et « floods sur nous »), 22 (Chasses, Armée, Niveaux, Production, Partage fusionné), puis les Demandes (23, 24) et Discord (25, 26).
