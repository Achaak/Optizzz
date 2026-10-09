# Feature : Rapports de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`. Rapports d'attaque et de défense : [#1](https://github.com/Achaak/Optizzz/issues/1).

## But

Lire d'un coup d'œil ce qu'ont donné ses chasses, et voir si le simulateur prévoit bien les pertes.

## Comportement

- **Quand** : à l'ouverture d'une conversation « Chasses » de `messagerie.php` (le jeu charge le détail en AJAX ; un `MutationObserver` le repère, sans réagir aux changements de son propre tableau). Aucune requête en plus, sauf `laboratoire.php` / `construction.php` si `game-levels` ne connaît pas encore les niveaux.
- **Tableau** au-dessus des combats : Date | Armée envoyée | Proies | Pertes | Promues | cm² | Nourriture, une ligne par combat, puis un total (« Total : 20 combats affichés sur 191 » quand le titre de la conversation en annonce plus) et « N cm² par fourmi tuée (d'après les rapports, sans les blessées) ». Un nombre et son unité ne sont jamais coupés (« 1 921 JSN ») ; le nom complet des unités est dans l'infobulle de la cellule. Le texte du jeu est replié (masqué, pas supprimé) derrière « Voir le texte du jeu » ; ses contrôles (« Corbeille ») passent dans la barre d'outils, toujours visibles.
- **Prévision** : chaque combat est rejoué par le moteur (`src/game/army/combat.ts`). Armes déduites du rapport (bonus ÷ dégâts × 10), Bouclier et Étable à cochenilles mémorisés par `game-levels` (niveaux **actuels** : un combat antérieur à une montée de Bouclier peut dévier). « 4 (prévu 4, +1 blessée) » : tuées réelles, tuées prévues, blessées à plus de la moitié de leur vie (perdues, absentes du rapport). Ligne colorée quand l'écart dépasse 1 fourmi **et** 20 % ; le total compte ces combats. Niveaux illisibles : « Bouclier inconnu : passez au Laboratoire », sans prévision. Une unité ou une proie que le moteur ne connaît pas : « (pas de prévision : X inconnu) » plutôt qu'une prévision fausse.
- **Combats précédents** : le jeu n'affiche que les 10 derniers ; « Voir les combats précédents » clique sur son lien « Voir les messages précédents » et le tableau se met à jour.
- **Copier les combats** (« Copié ! » pendant 3 s) : une ligne par combat, au format de `src/game/army/__fixtures__/hunt-reports.ts` (`date|armée|proies|dégâts base+bonus|proies tuées|dégâts reçus|fourmis tuées|promues|cm²|nourriture`), sans pseudo.

## Code

| Fichier                                        | Rôle                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `src/features/hunt-reports/report.ts` (+ test) | Lecture des combats, prévision, ligne copiée, total     |
| `src/features/hunt-reports/mount.ts` (+ test)  | Tableau, texte du jeu replié, copie, combats précédents |
| `src/features/hunt-reports/index.ts`           | La feature : repère les conversations ouvertes          |
