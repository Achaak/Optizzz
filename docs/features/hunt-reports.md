# Feature : Rapports de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`. Rapports d'attaque et de défense : [#1](https://github.com/Achaak/Optizzz/issues/1).

## But

Lire d'un coup d'œil ce qu'ont donné ses chasses, et voir si le simulateur prévoit bien les pertes.

## Comportement

- **Quand** : à l'ouverture d'une conversation « Chasses » de `messagerie.php` (le jeu charge le détail en AJAX ; un `MutationObserver` le repère). Aucune requête en plus, sauf `laboratoire.php` / `construction.php` si `game-levels` ne connaît pas encore les niveaux.
- **Tableau** au-dessus des combats : Heure | Armée envoyée | Proies | Pertes | Promues | cm² | Nourriture, une ligne par combat, puis un total et « N cm² par fourmi perdue ». Le texte du jeu est replié (masqué, pas supprimé) derrière « Voir le texte du jeu ».
- **Prévision** : chaque combat est rejoué par le moteur (`src/game/army/combat.ts`). Armes déduites du rapport (bonus ÷ dégâts × 10), Bouclier et Étable à cochenilles mémorisés par `game-levels` (niveaux **actuels** : un combat antérieur à une montée de Bouclier peut dévier). « 4 (prévu 4, +1 blessée) » : tuées réelles, tuées prévues, blessées à plus de la moitié de leur vie (perdues, absentes du rapport). Ligne colorée quand l'écart dépasse 1 fourmi **et** 20 % ; le total compte ces combats. Niveaux illisibles : « Bouclier inconnu : passez au Laboratoire », sans prévision.
- **Combats précédents** : le jeu n'affiche que les 10 derniers ; « Voir les combats précédents » clique sur son lien « Voir les messages précédents » et le tableau se met à jour.
- **Copier les combats** : une ligne par combat, au format de `src/game/army/__fixtures__/hunt-reports.ts` (`date|armée|proies|dégâts base+bonus|proies tuées|dégâts reçus|fourmis tuées|promues|cm²|nourriture`), sans pseudo.

## Code

| Fichier                                        | Rôle                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `src/features/hunt-reports/report.ts` (+ test) | Lecture des combats, prévision, ligne copiée, total     |
| `src/features/hunt-reports/mount.ts` (+ test)  | Tableau, texte du jeu replié, copie, combats précédents |
| `src/features/hunt-reports/index.ts`           | La feature : repère les conversations ouvertes          |
