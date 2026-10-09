# Feature : Historique de progression

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-08. Source des données : `../research/fourmizzz-api-exports.md`.

## But

Voir en courbes le TDC et les scores (Fourmilière, Technologie, Combat) dans le temps, pour soi, pour comparer avec les membres de son alliance, et sur le profil de n'importe quel joueur.

## Données

- **Passé** : l'export public des joueurs, **un point par jour** : la première version de chaque jour de Paris, c'est-à-dire l'export de minuit (22:00 UTC l'été, 23:00 UTC l'hiver). Les exports horaires ne sont pas utilisés : 24 fois plus de téléchargements pour presque rien en plus, et la première version d'un jour ne change plus une fois publiée.
- **Maintenant** : un dernier point, creux, « en direct » dans l'infobulle :
  - vue d'alliance : TDC, Technologie et Fourmilière du tableau Membres (le Combat n'y est pas : sa courbe s'arrête au dernier export) ;
  - profil : les scores de `table.tableau_score` ; une ligne absente ou renommée ne donne pas de point en direct (plutôt qu'une chute à 0).
- L'historique de l'API commence le 2026-09-30 (S2) / 2026-10-01 (S5).
- **Hypothèse** : « Combat » sur le profil = `trophyScore` de l'export. Non vérifié (tout le monde est à 0 sur S5 le 2026-10-08).

## Cache

- Une entrée par version et par serveur, `local:history:<host>:<version>` : **tous les joueurs** en colonnes (id, TDC, Fourmilière, Technologie, Combat), sans pseudo ni alliance. Environ 25 Ko par version sur S5, 500 Ko sur S2 (l'export brut pèse 225 Ko / 4,2 Mo). Tient grâce à `unlimitedStorage`, déjà demandée pour la Carte.
- Une version n'est téléchargée qu'une fois ; une version que l'API ne donne pas est sautée. Jamais purgé.
- Pseudos et alliances viennent du dernier export (cache de la Carte) : un joueur s'identifie par son id, un membre arrivé récemment a donc tout son historique.
- Chargement du plus récent au plus ancien, une version à la fois, avec une barre de progression ; la courbe se remplit au fur et à mesure. Changer de période ou quitter la vue arrête les téléchargements en cours. La liste des versions (`/api/exports/`) n'est demandée qu'une fois quand plusieurs lectures la veulent en même temps.

## Comportement

- **Période** : 7 j / 14 j / 30 j / Tout, **14 j par défaut**. Onglets TDC / Fourmilière / Technologie / Combat (les mots du jeu).
- **Vue d'alliance** : entrée « Historique » du menu d'alliance, après « Chaîne » (ou « Carte », ou « Membres »), `alliance.php?Membres#historique` ; remplace le tableau des membres tant que le hash est `#historique`.
  - Une ligne par membre coché ; par défaut moi seul (en gras). Case « Moyenne de l'alliance » (pointillés) : moyenne des membres actuels présents à chaque export.
  - Tableau « Progression sur la période » : chaque membre, valeur de début, maintenant (« Dernier export » sur l'onglet Combat, absent du tableau Membres), gain et %, triable sur toutes ces colonnes (gain décroissant par défaut) ; les en-têtes sont des boutons, la colonne active porte ▲ ou ▼. La case de chaque ligne affiche sa courbe.
  - Le bandeau « Depuis le … » date le début des courbes affichées (un membre arrivé plus tard commence plus tard).
  - Titre « Historique de progression TAG », comme « Carte de l'alliance TAG » et « Chaîne de TDC TAG ».
  - Sans alliance dans le dernier export : un message. Export injoignable : un message en clair, le détail en console.
- **Profil** (`Membre.php`, le mien ou celui d'un autre) : encart « Progression » sous « Informations », une seule courbe, et « Sur la période : +N (+x %) ». Lien « Comparer avec l'alliance » quand le joueur est de mon alliance (pas sur mon propre profil : je suis déjà la courbe par défaut) : il l'ajoute aux courbes de la vue d'alliance et l'ouvre. Joueur pas encore exporté : un message.
- **Mémorisé par serveur** (`local:history:<host>:settings`) : membres cochés, moyenne, période, onglet (partagés entre la vue et le profil).
- Interrupteur « Historique de progression », options « Entrée « Historique » dans le menu d'alliance » et « Encart « Progression » sur les profils ».

## Plus tard

- Comparer avec des joueurs hors de l'alliance (rivaux), ou entre alliances (export des alliances).
- Points horaires sur les dernières 24 h.

## Code

| Fichier                                                                                       | Rôle                                                                        |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/features/history/versions.ts` (+ test)                                                   | Date d'une version, une version par jour de Paris sur la période            |
| `src/features/history/api.ts` (+ test)                                                        | Historique de tous les joueurs, cache compact par version                   |
| `src/features/history/series.ts` (+ test)                                                     | Courbe d'un joueur, moyenne, progression sur la période                     |
| `src/game/pages/scores.ts` (+ test)                                                           | Scores en direct : profil (`table.tableau_score`), tableau Membres          |
| `src/features/history/settings.ts`                                                            | Réglages mémorisés                                                          |
| `src/features/history/chart-option.ts`, `HistoryChart.tsx`                                    | Graphique ECharts (ligne, axe temps)                                        |
| `src/features/history/useHistory.ts`                                                          | Chargement progressif de la période                                         |
| `src/features/history/AllianceHistory.tsx`, `ProfileHistory.tsx`, `controls.tsx`, `style.css` | Vues React                                                                  |
| `src/features/history/menu.ts`                                                                | Entrée de menu (script léger, toutes les pages)                             |
| `src/entrypoints/history.content/index.tsx`                                                   | Script dédié à `alliance.php` et `Membre.php` : monte les vues (Shadow DOM) |

Vérifié dans le jeu (S5, 2026-10-08) : profil (le mien, un joueur sans alliance), vue d'alliance (15 membres, courbes cochées, moyenne, onglet Combat, retour à Membres).
