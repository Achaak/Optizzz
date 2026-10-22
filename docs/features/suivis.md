# Feature : Suivis

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-17. Source des données : `../research/fourmizzz-api-exports.md`.

## But

Suivre des joueurs et des alliances (cibles et rivaux d'abord, alliés aussi) et voir ce qui a changé depuis la dernière fois qu'on a regardé, calculé depuis les exports publics, sans serveur.

## Liste

- **Joueurs**, reconnus par leur id (un changement de pseudo est suivi : « NouveauPseudo (ex-Ancien) ») ; **alliances**, reconnues par leur tag (l'export n'a pas d'id d'alliance : un changement de tag la perd).
- Ajout : lien « Suivre » sur un profil (`Membre.php`, ligne « Suivis : » sous « Etat ») et sur la page publique d'une alliance (`classementAlliance.php?alliance=TAG`, sous son nom). Une fois suivi : « Dans vos suivis · Voir · Ne plus suivre » (« Voir » ouvre la vue). Sans glyphe, comme les liens du jeu. Champ d'ajout avec complétion (pseudos, et `[TAG]` des alliances) dans la vue.
- **100 entrées par serveur** au plus, joueurs et alliances confondus ; au-delà, un message.
- Une entrée absente du dernier export reste dans la liste, marquée « n'existe plus », jusqu'à ce qu'on la retire.
- `sync:watchlist:<host>` (`storage.sync`) : la liste et, par entrée, le repère « vu » (version d'export et TDC à ce moment). Synchronisée par le navigateur entre appareils d'une même famille (Chrome ↔ Chrome, Firefox ↔ Firefox), sans serveur d'Optizzz. Rien entre Chrome et Firefox.

## Changements

- **Joueur** : alliance (rejoint, quitté, quitté pour une autre), vacances (départ, retour), banni, disparu. Le **TDC** n'est pas un événement : la vue montre l'écart avec le repère « vu », et le signale au-delà de **± 5 %**. Pas les scores Fourmilière, Technologie, Combat.
- **Alliance** : membres arrivés et partis (nommés), guerres (nouvelle, déclarée par elle ou contre elle ; finie), pactes (nouveau, rompu), disparue ; le TDC total comme pour un joueur.
- **Relevé** (background) : **chaque heure**, sur les serveurs dont la liste n'est pas vide. L'export des joueurs est toujours lu (TDC, alliance, vacances, et les membres d'une alliance, que l'export des alliances ne nomme pas) ; celui des alliances seulement si une alliance est suivie. Rien n'est téléchargé quand la version n'a pas changé, et un export déjà mis en cache par Cibles ou la Carte sert tel quel (`apps/extension/src/data/exports.ts`).
- Chaque relevé garde un état compact des seules entrées suivies (`local:watchlist:<host>:state`) et le compare au précédent : les différences vont au **journal** (`local:watchlist:<host>:journal`, local à chaque appareil, gardé **30 jours**). Un changement est daté par les deux relevés qui l'encadrent : « aujourd'hui 13 h 00 », ou « aujourd'hui entre 0 h 00 et 8 h 00 » quand le navigateur était fermé (les versions manquantes ne sont pas téléchargées).
- **Non vu** : ce que le journal a noté après le repère « vu » de l'entrée. « Vu » sur une ligne, ou « Tout marquer comme vu ». Le repère étant synchronisé, une entrée vue sur un appareil l'est sur l'autre.
- **Exception aux Alertes** : jusqu'ici le background ne lisait que les données mémorisées. Le relevé des Suivis télécharge l'export public (même hôte `*.fourmizzz.fr`, aucune nouvelle permission).

## Vue « Suivis »

- Bouton « Suivis » dans la barre du haut du jeu : une page par-dessus le jeu (`apps/extension/src/utils/page-dialog.ts`, comme la Carte du serveur), aussi ouvrable dans un onglet. Une notification ou le popup y mènent par `Reine.php#optizzz-suivis`.
- Deux tableaux, **Joueurs** et **Alliances**, les lignes avec du nouveau d'abord :
  - joueur : pseudo (lien vers le profil), alliance, TDC et écart depuis « vu », état (vacances, banni, n'existe plus), distance et trajet depuis chez moi (vitesse d'attaque connue), changements non vus ;
  - alliance : tag (lien vers sa page), membres, TDC total et écart, changements non vus.
- Titre « Suivis · S5 ». Par ligne : « Vu » (si du nouveau), « Retirer » (aussitôt, avec « Annuler » dans le message, qui remet l'entrée et son repère). En haut : le champ d'ajout, « Tout marquer comme vu (N) », puis la date du dernier relevé (absente tant que la liste est vide). Liste vide : comment ajouter.

## Popup

- Option « Résumé dans le popup » : au-dessus des onglets, par serveur ayant une liste, « Suivis S5 : 3 avec du nouveau » (ou « rien de nouveau ») et les trois derniers changements (« Rival : a quitté ABC pour XYZ (aujourd'hui 13 h 00) ») ; « Ouvrir » ouvre le jeu sur la vue. Calculé sur l'état du dernier relevé, sans téléchargement.
- Le badge ne change pas : il reste réservé à la famine et aux entrepôts pleins.

## Notifications

- Dans l'onglet « Notifications », groupe « Suivis », coupées par défaut : « TDC perdu d'au moins [20] % » (entre deux relevés, seuil réglable, `sync:watchlistLossPercent`), changement d'alliance, vacances, nouvelle guerre, pacte rompu, membre parti ou arrivé.
- **Un résumé par relevé et par serveur** : « Suivis S5 : Rival −32 % de TDC · ABC : guerre déclarée par XYZ ». Un clic ouvre la vue.

## Interrupteur

Feature « Suivis » dans « Fonctionnalités » : « Bouton dans la barre du haut », « Bouton Suivre sur les profils et les pages d'alliance », « Résumé dans le popup ». Coupée, plus aucun relevé.

## Code

| Fichier                                                        | Rôle                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/extension/src/data/watchlist.ts` (+ test)                | Liste et repères « vu » par serveur (`storage.sync`), limite    |
| `apps/extension/src/features/watchlist/changes.ts` (+ test)    | État compact des suivis, différences entre deux relevés, non vu |
| `apps/extension/src/features/watchlist/describe.ts` (+ test)   | Les changements en français, résumé des notifications           |
| `apps/extension/src/features/watchlist/background.ts` (+ test) | Relevé horaire, journal, notifications                          |
| `apps/extension/src/features/watchlist/index.ts`               | Bouton de la barre, ouverture par `#optizzz-suivis`             |
| `apps/extension/src/features/watchlist/follow.ts` (+ test)     | « Suivre » sur les profils et les pages d'alliance              |
| `apps/extension/src/features/watchlist/Watchlist.tsx`          | Vue React                                                       |
| `apps/extension/src/entrypoints/watchlist/`                    | Page de l'extension (cadre par-dessus le jeu ou onglet)         |
