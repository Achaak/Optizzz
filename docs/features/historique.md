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

- Une entrée par version et par serveur, `local:history:<host>:<version>` : **tous les joueurs** en colonnes (id, TDC, Fourmilière, Technologie, Combat, alliance), sans pseudo. L'alliance est un numéro dans la liste des tags de la version (ajoutée le 2026-10-17 : une version enregistrée avant est retéléchargée une fois). Environ 30 Ko par version sur S5, 600 Ko sur S2 (l'export brut pèse 225 Ko / 4,2 Mo). Tient grâce à `unlimitedStorage`, déjà demandée pour la Carte.
- Une version n'est téléchargée qu'une fois ; une version que l'API ne donne pas est sautée. Jamais purgé.
- Pseudos et alliances viennent du dernier export (cache de la Carte) : un joueur s'identifie par son id, un membre arrivé récemment a donc tout son historique.
- Chargement du plus récent au plus ancien, une version à la fois, avec une barre de progression ; la courbe se remplit au fur et à mesure. Changer de période ou quitter la vue arrête les téléchargements en cours. La liste des versions (`/api/exports/`) n'est demandée qu'une fois quand plusieurs lectures la veulent en même temps.

## Comportement

- **Période** : 7 j / 14 j / 30 j / Tout, **14 j par défaut**. Onglets TDC / Fourmilière / Technologie / Combat (les mots du jeu).
- **Vue d'alliance** : entrée « Progression » du menu d'alliance (« Historique » jusqu'au 2026-10-16, renommée pour la distinguer des Statistiques d'alliance), après « Chaîne » (ou « Carte », ou « Membres »), `alliance.php?Membres#historique` ; remplace le tableau des membres tant que le hash est `#historique`.
  - Une ligne par membre coché ; par défaut moi seul (en gras). Case « Moyenne de l'alliance » (pointillés) : moyenne des membres actuels présents à chaque export.
  - Tableau « Progression sur la période » : chaque membre, valeur de début, maintenant (« Dernier export » sur l'onglet Combat, absent du tableau Membres), gain et %, triable sur toutes ces colonnes (gain décroissant par défaut) ; les en-têtes sont des boutons, la colonne active porte ▲ ou ▼. La case de chaque ligne affiche sa courbe.
  - Le bandeau « Depuis le … » date le début des courbes affichées (un membre arrivé plus tard commence plus tard).
  - Titre « Progression des membres de TAG ». Sous le titre, un sélecteur « L'alliance / Chaque membre » mène aux Statistiques d'alliance (`statistiques-alliance.md`) quand elles sont allumées.
  - Sans alliance dans le dernier export : un message. Export injoignable : un message en clair, le détail en console.
- **Profil** (`Membre.php`, le mien ou celui d'un autre) : encart « Progression » sous « Informations », une seule courbe, et « Sur la période : +N (+x %) ». Lien « Comparer avec l'alliance » quand le joueur est de mon alliance (pas sur mon propre profil : je suis déjà la courbe par défaut) : il l'ajoute aux courbes de la vue d'alliance et l'ouvre. Joueur pas encore exporté : un message.
- **Changements d'alliance** (profil, sous « Sur la période ») : « Changements d'alliance sur la période : » puis un changement par ligne, le plus récent d'abord, la date en gras en tête : « **14/10** · a quitté ABC pour XYZ », « **09/10** · a rejoint ABC », « **du 03/10 au 05/10** · a quitté OLD » quand des exports manquent. Tags cliquables vers la page de l'alliance. Sans changement, en discret : « Toujours dans XYZ sur la période. » ou « Sans alliance sur toute la période. ». Comparaison sans la casse, exports sans le joueur sautés. Le dernier export horaire clôt la série : un changement du jour est vu dans l'heure. Daté au jour de Paris (l'export de minuit sépare les jours).
- **Mémorisé par serveur** (`local:history:<host>:settings`) : membres cochés, moyenne, période, onglet (partagés entre la vue et le profil).
- Interrupteur « Historique de progression », options « Entrée « Progression » dans le menu d'alliance (chaque membre) » et « Encart « Progression » sur les profils ».

## Plus tard

- Comparer avec des joueurs hors de l'alliance (rivaux). Entre alliances : voir `statistiques-alliance.md`.
- Points horaires sur les dernières 24 h.

## Code

| Fichier                                                                        | Rôle                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/data/export-history.ts` (+ test)                                          | Date d'une version, une version par jour de Paris, cache et chargement progressif (partagés avec les Statistiques d'alliance) |
| `src/features/history/api.ts` (+ test)                                         | Historique de tous les joueurs, cache compact par version                                                                     |
| `src/features/history/series.ts` (+ test)                                      | Courbe d'un joueur, moyenne, progression sur la période                                                                       |
| `src/features/history/alliance-moves.ts` (+ test)                              | Changements d'alliance d'un joueur, et leur jour                                                                              |
| `src/game/pages/scores.ts` (+ test)                                            | Scores en direct : profil (`table.tableau_score`), tableau Membres                                                            |
| `src/features/history/settings.ts`                                             | Réglages mémorisés                                                                                                            |
| `src/utils/history-chart/`                                                     | Graphique ECharts (ligne, axe temps), onglets et période, progression, `style.css` (partagés)                                 |
| `src/features/history/useHistory.ts`                                           | Chargement progressif de la période                                                                                           |
| `src/features/history/AllianceHistory.tsx`, `ProfileHistory.tsx`, `metrics.ts` | Vues React                                                                                                                    |
| `src/features/history/menu.ts`                                                 | Entrée de menu (script léger, toutes les pages)                                                                               |
| `src/entrypoints/history.content/index.tsx`                                    | Script dédié à `alliance.php` et `Membre.php` : monte les vues (Shadow DOM)                                                   |

Vérifié dans le jeu (S5, 2026-10-08) : profil (le mien, un joueur sans alliance), vue d'alliance (15 membres, courbes cochées, moyenne, onglet Combat, retour à Membres).
