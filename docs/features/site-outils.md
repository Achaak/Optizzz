# Outils du site (étape 2b) : socle

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Étape 2b du site public (`site-public.md`). Une page par outil : `site-trajets.md`, `site-couts.md`, `site-combat.md`, `site-chasse.md`, `site-flood.md` ; la carte du serveur a la sienne (`site-carte.md`).

## Adresses

Les adresses du site sont en anglais ; ce que lit le visiteur (titres, menus, libellés) reste en français. Pas de redirection depuis les anciennes adresses françaises : le site n'a pas été en ligne assez longtemps pour que des liens comptent (décidé le 2026-10-23).

| Page                     | Adresse                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Liste des outils         | `/tools`                                                                                    |
| Outils                   | `/tools/travel`, `/tools/costs`, `/tools/combat`, `/tools/hunt`, `/tools/flood`             |
| Pages d'un serveur       | `/s5`, `/s5/players`, `/s5/players/[id]`, `/s5/alliances`, `/s5/alliances/[tag]`, `/s5/map` |
| Données de la carte      | `/api/s5/map`                                                                               |
| Pages légales            | `/privacy`, `/legal`                                                                        |
| Paramètres d'une adresse | en anglais aussi (« Voir sur la carte » : `/s5/map?player=…`, `/s5/map?alliance=…`)         |

Les outils n'ont pas de serveur dans l'adresse : les règles (unités, combat, coûts) sont les mêmes sur tous les serveurs. Un outil qui en a besoin (trajets, flood par pseudo) a un champ Serveur, gardé dans son état.

## Page `/tools` et en-tête

- `/tools` liste les outils prévus, avec une phrase chacun ; un outil pas encore fait est listé sans lien. La carte y figure aussi (elle demande de choisir un serveur).
- Une entrée « Outils » dans l'en-tête du site, sur ordinateur et sur téléphone.
- Un gabarit de page d'outil : titre, description, formulaire, résultat. Sur téléphone, le résultat vient sous le formulaire.
- Ajouter un outil ne demande de toucher qu'à sa page et à une ligne de la liste.
- Les outils sont indexés par les moteurs de recherche : la page est rendue côté serveur, sans état ; l'état se lit dans le navigateur.

## État dans l'adresse

- L'état d'un outil (et de la carte) tient dans le **fragment** de l'adresse : `#p=1.<base64url>`. Le fragment n'est jamais envoyé au serveur : ni le serveur du site ni un journal ne voient l'armée ou les niveaux d'un lien.
- Contenu : JSON à clés courtes, en base64url, sans compression (un combat complet tient sous 1 000 caractères). Le préfixe `1.` est la version du format : quand un outil change son état, il passe à `2.` et sait encore relire `1.`.
- Chaque outil valide son état avec zod. Une adresse invalide (lien tronqué, version inconnue) est refusée proprement : l'outil s'ouvre vide, avec une note « Ce lien n'est pas valide ».
- À chaque saisie, le fragment est remis à jour (`history.replaceState` : pas une entrée d'historique par frappe). Un bouton « Copier le lien » copie l'adresse.
- Les liens de carte en `?p=…` ne sont pas relus après le passage à `#p=` (même raison que l'absence de redirection).
- Le code commun (encodage, version, validation, le schéma de l'état de chaque outil ouvrable depuis l'extension, l'adresse du site) vit dans `packages/game/src/site-links/`, partagé par le site et l'extension.

## Mémoire du navigateur

- Ouvert sans lien, un outil reprend son dernier état du navigateur (`localStorage`), comme la carte.
- **Mes niveaux** : un seul jeu de niveaux, commun à tous les outils, gardé dans le `localStorage` : Armes, Bouclier Thoracique, Vitesse d'attaque, Vitesse de chasse, Dôme, Loge Impériale, Étable à pucerons, Étable à cochenilles, Architecture, Salle d'analyse, Couveuse, Solarium, Technique de ponte (clés de `packages/game/src/levels.ts`). Chaque outil pré-remplit les niveaux qu'il demande avec « Mes niveaux ».
- Ouvert sans lien : ce que le visiteur tape dans un champ de niveau devient « Mes niveaux », sans bouton.
- Ouvert depuis un lien (partagé, ou venu de l'extension) : les niveaux du lien s'affichent, « Mes niveaux » ne bouge pas, et un bouton « Reprendre mes niveaux » remet les siens.
- Pas de page pour éditer « Mes niveaux » à part.

## Sélecteur de joueur

Un composant du socle, utilisé par les trajets et le flood : choisir un serveur, puis un joueur par son pseudo (recherche dès deux lettres, comme la recherche de l'en-tête). Il rend l'id, le pseudo, la position et le TDC du joueur, lus dans la base du site. Une position peut être saisie à la place d'un joueur (x et y).

## Depuis l'extension

- Le simulateur de combat, le Lanceur de chasse et le Plan de flood de l'extension ont deux actions : **« Ouvrir sur optizzz.fr »** (nouvel onglet, `tabs.create`, sans permission) et **« Copier le lien »**, avec leurs entrées courantes (armées, niveaux, TDC). Le lien est construit dans l'extension avec `packages/game/src/site-links/` : l'état part dans le fragment, rien n'est envoyé au site.
- Au clic seulement ; rien ne part sans action du joueur. Pas de bouton pour les trajets ni les coûts (pas d'outil semblable dans l'extension).
- Option **« Liens vers optizzz.fr »** dans « Fonctionnalités » (`catalog.ts`), cochée par défaut : décochée, les boutons disparaissent. Elle porte aussi les liens vers le site depuis le menu, les profils et les pages d'alliance (`liens-site.md`).
- `PRIVACY.md` et `docs/store/fiche.md` le disent : ouvrir un outil depuis l'extension fait visiter optizzz.fr (adresse IP vue par le serveur du site, non gardée), sans transmettre l'armée ni les niveaux au serveur. `data_collection_permissions` reste `none`.
- Le socle fournit l'option et la construction de l'adresse ; chaque outil (tickets 09, 10, 11) pose ses boutons, et vérifie que le site donne le même résultat que l'extension pour le lien qu'elle ouvre.

## Code du socle

Fait le 2026-10-23 (ticket 05). Ajouter un outil : sa page `apps/web/src/app/tools/<id>/page.tsx` (et ses composants à lui), son schéma s'il est ouvrable depuis l'extension (`packages/game/src/site-links/<id>.ts`), et `ready: true` sur sa ligne de `tool-list.ts`.

| Fichier                                                                              | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/game/src/site-links/link-state.ts` (+ test)                                | `defineLinkFormat` : un outil déclare son schéma zod et sa version (clés courtes, `toWire` / `fromWire` s'il garde d'autres noms) ; les versions anciennes encore lues (`earlierFormat`) ; `readLinkState` lit `#p=`                                                                                                                                                                                                                                                                 |
| `packages/game/src/site-links/site.ts` (+ test)                                      | `SITE_URL`, les outils (`SITE_TOOLS`) et leur adresse (`siteToolUrl`), pour le site et l'extension                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/web/src/components/map/map-state.ts` (+ test)                                  | La carte déclare son format avec `defineLinkFormat`, sans changer ses liens                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/src/app/tools/page.tsx`, `components/tools/tool-list.ts`                   | `/tools` : une ligne par outil (titre, phrase, `ready`), la carte avec ses serveurs ; `toolMetadata` donne le titre et la description de la page d'un outil                                                                                                                                                                                                                                                                                                                          |
| `apps/web/src/components/site-header.tsx`                                            | L'entrée « Outils » de l'en-tête                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/src/components/tools/tool-page.tsx`                                        | Gabarit : `ToolPage` (titre, description), `ToolLayout` (actions, saisie, résultat ; le résultat sous la saisie sur téléphone), `InvalidLinkNote`                                                                                                                                                                                                                                                                                                                                    |
| `apps/web/src/components/tools/tool-state.ts` (+ test), `use-tool-state.ts` (+ test) | L'état d'ouverture (lien, sinon dernier état du navigateur, sinon vide ; lien illisible : vide avec la note) ; `useToolState` réécrit `#p=` à chaque saisie (`replaceState`) et le garde dans `localStorage` ; un lien ne remplace le dernier état du navigateur qu'une fois modifié (rechargé, il reste un lien), et le fragment que l'outil a écrit lui-même n'est pas un lien ; suivi depuis un `Link` du site, l'outil attend que Next ait écrit son adresse avant de lire `#p=` |
| `apps/web/src/components/tools/copy-link-button.tsx`                                 | « Copier le lien »                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/web/src/components/tools/my-levels.ts` (+ test), `use-my-levels.tsx`           | « Mes niveaux » (`optizzz:my-levels`) : `pickLevels` pré-remplit un outil (par `withMyLevels` de `useToolState`), `remember` garde la saisie hors lien, `ResumeLevelsButton` (« Reprendre mes niveaux ») ; après lui, la saisie redevient « Mes niveaux »                                                                                                                                                                                                                            |
| `apps/web/src/components/tools/player-picker.tsx`                                    | `ServerSelect`, `PlayerPicker` (joueur par pseudo dès deux lettres, ou position x, y) et `usePickedPlayer` (relit un joueur gardé par son id) ; tRPC `players.search` (filtre `server`, position et TDC) et `players.byId`                                                                                                                                                                                                                                                           |
| `apps/extension/src/utils/site-tool.ts` (+ test)                                     | `siteLinksEnabled` (option « Liens vers optizzz.fr » de `catalog.ts`), `siteToolLink` (« Copier le lien »), `openSiteTool` : le script d'arrière-plan ouvre l'onglet (`tabs.create`) si l'option est cochée                                                                                                                                                                                                                                                                          |

Tant qu'aucun outil n'importe les fichiers de `apps/web/src/components/tools/`, ils sont déclarés comme points d'entrée dans `knip.json` : knip ne signale donc pas leurs exports encore inutilisés. L'entrée peut partir quand les outils s'en servent.

## Aide d'un outil (« Comment ça marche »)

Ajouté le 2026-11-12 après le refus d'AdSense (`site-publicite.md`). Maquette : artboard « E · Outil : « Comment ça marche » (chasse) » du canevas « Optizzz — maquettes du site ».

- Sous l'outil, un texte **rendu par le serveur**, présent avant toute saisie : les règles que suit l'outil, numérotées, chacune avec sa mention (`CertaintyMark` des guides) quand elle en a une, une formule et un exemple calculé avec les fonctions de `@optizzz/game`.
- À gauche, le titre, le sommaire et « Lire le guide » quand le guide de l'outil est écrit ; le texte à droite (dessous sur téléphone).
- La publicité de l'outil vient sous ce texte, jamais à côté du formulaire. Un outil sans aide n'en a pas.
- Briques : `apps/web/src/components/tools/tool-help.tsx` (`ToolHelp`, `HelpSection`, `Formula`) ; `ToolPage` prend l'aide en `help`.
- Fait : simulateur de chasse (`hunt/hunt-help.tsx`, d'après `../research/chasse.md`). À faire : combat, flood, trajet, coûts.

## Hors 2b

Prérequis et listes de plusieurs éléments dans l'outil des coûts ; ponte des ouvrières d'une recherche ; suivi d'attaques en route sur le site ; bouton de l'extension vers les trajets ou les coûts.
