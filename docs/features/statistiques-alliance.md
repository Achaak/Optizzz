# Feature : Statistiques d'alliance

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-16. Sources : `../research/fourmizzz-api-exports.md` (export des alliances) et `../research/fourmizzz-pages.md` (`classementAlliance.php`).

## But

Suivre son alliance comme un bloc, dans le temps et maintenant, et la comparer à d'autres alliances. L'Historique de progression (`historique.md`) reste l'outil des joueurs.

## Données

- **Passé** : l'export public des **alliances**, un point par jour de Paris (la première version du jour, celle de minuit, comme l'Historique). Ce sont les vrais totaux du jour : un départ fait baisser la courbe. La moyenne des membres _actuels_ reste dans l'Historique.
- **Maintenant, mon alliance** : une requête vers `classementAlliance.php?alliance=TAG` à l'ouverture de la vue (`fetchGamePage`) : les cinq totaux en direct, Combat compris, et les **rangs du jeu**. Page injoignable : la somme du tableau Membres (sans le Combat) et le rang au dernier export.
- **Maintenant, les autres alliances** : leurs courbes s'arrêtent au dernier export. Pas de rang « estimé » (comparer notre direct aux exports de minuit des autres serait faux une bonne partie de la journée).
- **Indicateurs** : TDC, Production, Fourmilière, Technologie, Combat, Membres. Bascule **Total / Moyenne par membre** (Total par défaut), masquée sur l'onglet Membres. Le rang sur chaque indicateur est calculé dans l'export parmi toutes les alliances ; il apparaît dans l'infobulle et le tableau, pas en courbe.
- L'armée du Partage d'alliance n'est pas reprise : incomplète et sensible. Les ouvrières servent à la production réelle (voir plus bas).

## Cache

- Une entrée par version et par serveur, `local:alliance-stats:<host>:<version>` : **toutes les alliances** en colonnes (tag, membres, TDC, Fourmilière, Technologie, Combat). Une version n'est téléchargée qu'une fois, jamais purgée ; une version que l'API ne donne pas est sautée.
- Chargement du plus récent au plus ancien, une version à la fois, avec la barre de progression de l'Historique.

## Comportement

### Vue « Statistiques »

- Entrée « Statistiques » du menu d'alliance, après « Progression » (l'Historique de chaque membre), avant « Partage » : `alliance.php?Membres#stats`. Remplace le tableau des membres tant que le hash est `#stats`. Titre « Statistiques de l'alliance TAG », puis le sélecteur « L'alliance / Chaque membre » vers la Progression des membres.
- **Ordre** : Maintenant, Dans le temps (courbes, comparer, tableau), Répartition, Production (détail par membre replié).
- **Maintenant** : une carte par indicateur avec le total en direct, l'écart avec le dernier export (masqué quand il est nul) et le rang du jeu. Une carte se clique : elle choisit l'onglet des courbes et de la répartition.
- **Répartition** (onglet courant, pas sur Membres) : barres horizontales triées, pseudo, valeur, part du total, d'après le tableau Membres ; pour le Combat, le dernier export.
- **Courbes** : onglets TDC / Production / Fourmilière / Technologie / Combat / Membres, bascule Total / Moyenne dans la même barre, période 7 j / 14 j / 30 j / Tout (14 j par défaut), mon alliance en gras, son point « maintenant » creux.
- **Comparer** : aucune alliance par défaut. Un champ tag ou nom (liste de l'export), et des suggestions en un clic : pactes, guerres (dans les deux sens, sans la casse, sans l'alliance elle-même ; la suggestion dit « guerre déclarée », « guerre subie » ou « guerre réciproque »), les deux voisines au-dessus et au-dessous au classement de l'onglet. ✕ pour retirer.
- **Tableau** : une ligne par alliance affichée : début (sa date en infobulle), maintenant (dernier export pour les autres), gain, %, rang et son évolution sur la période (▲2, « 2 places gagnées depuis le 06/10 » en infobulle). Un tag inconnu : « Aucune alliance « X » dans le dernier export ». Triable, gain décroissant par défaut.
- Sans alliance : pas d'entrée de menu. Alliance absente de l'export (créée aujourd'hui) : le point en direct seul et « Pas encore dans l'export public ». Une alliance comparée qui disparaît de l'export garde sa courbe jusqu'à sa dernière apparition.

### Production

Décidé le 2026-10-16 (deuxième `/grill-me`). Calcul du jeu : min(TDC, ouvrières) × 48 par jour, moins la taxe de colonie (`../research/ressources-et-entretien.md`, `production-profil.md`).

- **Onglet « Production »** : le **plafond**, TDC × 48 (nourriture et matériaux ensemble, sans la champignonnière). Il suit le TDC (courbe, rang et comparaisons comme le TDC) mais se lit en ressources par jour.
- **Section « Production »** sous « Maintenant », pour mon alliance et à l'instant T seulement :
  - **plafond net** : le plafond, moins les taxes payées à des maîtres **hors** de l'alliance, plus celles touchées sur des colonies **hors** de l'alliance. Une taxe entre deux membres reste dans l'alliance : elle ne compte pas. Qui est colonisé par qui vient du dernier export (`masterPlayerId`) ;
  - **réel** : min(TDC, ouvrières) × 48 pour les membres dont on connaît les ouvrières (Partage d'alliance, saisie à la main comprise ; les miennes lues en direct dans l'en-tête de la page), avec « 14 / 23 membres connus », et le même solde de taxes ;
  - taux de taxe : le vrai quand on le connaît (le mien d'après `Ressources.php` si je suis colonisé, mon Étable à pucerons pour mes colonies), sinon 20 % (« au moins ») ;
  - **tableau par membre** : TDC, ouvrières, plafond, réel, taxe payée, taxes touchées ; triable. Une taxe entre deux membres y figure aussi, en gris (« dans l'alliance »), sur le réel quand on le connaît, sans compter dans le total de l'alliance. Un membre sans ouvrières connues montre « — » en réel.
- Nourriture et matériaux ne sont pas séparés : la répartition des ouvrières n'est connue que pour moi.

### Encart « Progression » sur la page d'une alliance

- `classementAlliance.php?alliance=TAG`, sous le tableau « Classement » : une courbe, mêmes onglets, période et bascule que la vue, « Sur la période : +N (+x %) », un point en direct lu dans le tableau Classement de la page.
- Lien « Comparer avec mon alliance » (l'ajoute aux comparaisons et ouvre la vue) ; « Voir les statistiques » sur la page de mon alliance. Pas de lien sans alliance ou quand la vue est coupée.
- Tag inconnu (titre vide) : pas d'encart.

### Graphique « Comparer les alliances » sur le classement des alliances

Ajouté le 2026-10-22, à la demande d'un joueur : comparer des alliances depuis le classement (Communauté → Alliances : `classement.php?type_classement=alliance_total`, ou `alliance_moyenne` ; `classementAlliance.php` sans `alliance` y redirige).

- **Au-dessus du cadre du classement** (recherche, menus et tableau du jeu), un panneau « Comparer les alliances » : mêmes onglets (TDC, Production, Fourmilière, Technologie, Combat = trophées, Membres), bascule **Total / Moyenne par membre** et période que la vue.
- **Colonne « Graphique »** ajoutée **à la fin** des lignes du tableau du jeu (une colonne en tête décalerait le tri du jeu) : une case par alliance. Cocher l'ajoute au graphique, décocher l'en retire. Une case cochée montre la couleur de sa courbe.
- **Les alliances cochées sont les alliances comparées** de la vue Statistiques (même réglage) : cocher ici les retrouve là-bas, et inversement. Mon alliance est toujours affichée (case cochée, grisée), en gras, en rouge comme le premier joueur des autres graphiques.
- **8 alliances au plus**, la mienne comprise : une couleur chacune, jamais deux fois la même (palette `CHART_COLORS.series`, vérifiée pour les daltoniens). Au-delà, les cases non cochées sont grisées avec la raison en infobulle. Une alliance garde sa couleur quand une autre arrive ou part : la couleur de chaque alliance comparée est mémorisée avec les réglages, la même ici et dans la vue, après rechargement aussi. Le rouge reste à mon alliance ; une nouvelle venue prend la première couleur libre (`apps/extension/src/features/alliance-stats/colors.ts`).
- **Légende en pastilles** sous le graphique (couleur, tag, « (vous) », ✕ pour retirer, « Tout retirer ») : elle sert aussi pour les alliances cochées sur une autre page, une autre league ou un autre type de classement, absentes du tableau affiché. Le nom de l'alliance est dans l'infobulle du tag : une couleur n'est jamais seule à dire de quelle alliance il s'agit.
- **Pas de point « en direct »** : le classement du jeu est moins frais que la page d'une alliance (`../research/fourmizzz-pages.md`). Les courbes s'arrêtent au dernier export de minuit.
- Sans alliance et rien de coché : à la place du graphique, « Cochez des alliances dans la colonne « Graphique » du tableau… ».
- Lecture du tableau par les liens `classementAlliance.php?alliance=TAG` de ses lignes, pas par le numéro de colonne : la table de `#centre` qui en a le plus (`packages/game/src/pages/alliances-ranking.ts`), seulement quand `#type_classement` vaut `alliance_*` (le classement des joueurs, même page, a aussi un lien d'alliance par ligne). Fixture copiée de la vraie page le 2026-10-22 (S5), réduite à trois lignes.
- Le jeu réécrit `#zone_classement` en AJAX (critère, league, type, page, clic sur un en-tête) : un `MutationObserver` remet la colonne à chaque fois (`followRanking`). Le panneau est hors de cette zone.

### Réglages et interrupteur

- Mémorisé par serveur (`local:alliance-stats:<host>:settings`), partagé entre la vue, l'encart et le graphique du classement, séparé de l'Historique : alliances comparées et leur couleur, période, onglet, Total / Moyenne.
- Interrupteur « Statistiques d'alliance », options « Entrée « Statistiques » dans le menu d'alliance », « Encart « Progression » sur les pages d'alliance » et « Graphique « Comparer les alliances » sur le classement des alliances ».

## Plus tard

- Une colonne « Part » dans le tableau Membres (Colonnes Membres).
- L'armée totale des états partagés, si l'alliance le veut.
- La champignonnière dans la production (formule à relever).

## Code

| Fichier                                                                                                    | Rôle                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/extension/src/data/export-history.ts` (+ test)                                                       | Versions d'un jour de Paris, chargement progressif (partagé avec l'Historique) |
| `apps/extension/src/utils/history-chart/`                                                                  | Graphique, onglets, période, barre de progression, formats (partagés)          |
| `apps/extension/src/features/alliance-stats/api.ts` (+ test)                                               | Historique de toutes les alliances, cache compact par version                  |
| `apps/extension/src/features/alliance-stats/production.ts` (+ test)                                        | Production de l'alliance : plafond, réel, taxes hors alliance                  |
| `apps/extension/src/features/alliance-stats/series.ts` (+ test)                                            | Courbe d'une alliance, rang, suggestions, répartition                          |
| `packages/game/src/pages/alliance-ranking.ts` (+ test)                                                     | Scores et rangs en direct de `classementAlliance.php?alliance=TAG`             |
| `packages/game/src/pages/alliances-ranking.ts` (+ test)                                                    | Lignes du classement des alliances (`classement.php`), tag par ligne           |
| `apps/extension/src/features/alliance-stats/ranking.ts` (+ test), `RankingChart.tsx`                       | Colonne « Graphique » (remise après l'AJAX), panneau « Comparer »              |
| `apps/extension/src/features/alliance-stats/colors.ts` (+ test)                                            | Couleur mémorisée de chaque alliance, la même dans la vue et le classement     |
| `apps/extension/src/features/alliance-stats/settings.ts`                                                   | Réglages mémorisés                                                             |
| `apps/extension/src/features/alliance-stats/AllianceStats.tsx`, `AllianceBox.tsx`, `useAllianceHistory.ts` | Vues React                                                                     |
| `apps/extension/src/features/alliance-stats/menu.ts`                                                       | Entrée de menu (script léger, toutes les pages)                                |
| `apps/extension/src/entrypoints/alliance-stats.content/index.tsx`                                          | Script dédié à `alliance.php`, `classementAlliance.php`, `classement.php`      |
