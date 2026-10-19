# Feature : Rapports de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`. Rapports d'attaque et de défense : [#1](https://github.com/Achaak/Optizzz/issues/1).

## But

Lire d'un coup d'œil ce qu'ont donné ses chasses, et voir si le simulateur prévoit bien les pertes.

## Comportement

- **Quand** : à l'ouverture d'une conversation « Chasses » de `messagerie.php` (le jeu charge le détail en AJAX ; un `MutationObserver` le repère, sans réagir aux changements de son propre tableau). Aucune requête en plus, sauf `laboratoire.php` / `construction.php` si `game-levels` ne connaît pas encore les niveaux, et `Reine.php` si la vitesse de ponte (`src/data/laying.ts`) est inconnue ou vieille de plus de 12 h.
- **Tableau** au-dessus des combats : Date | Armée envoyée | Proies | Pertes | Prévu | Promues | cm² | Nourriture, une ligne par combat, puis un total sur les trois premières colonnes (« Total : 20 combats affichés sur 191 · ⚠ 2 loin du prévu ») ; pas de total pour un combat seul. Le total « Prévu » n'est donné que si tous les combats ont une prévision. Les en-têtes des colonnes de nombres sont alignés à droite comme leurs valeurs ; dans « Prévu », les blessées sont en gris (« 9 +1 blessée »). L'explication du ⚠ sous le tableau n'apparaît que si un combat est signalé.
- **Bilan de l'armée** sous le tableau (retour de joueur du 2026-10-19, à la place de « N cm² par fourmi tuée ») : « Pertes : 200 JSN, soit 31 min de ponte et −600 dégâts hors bonus. », « Expérience : +54 SN, +12 NE, +88 S, +17 SE, +28 AE, soit +865 dégâts hors bonus. », « Bilan : +265 dégâts hors bonus. ». Le rapport ne donne que le nombre de mortes : elles sont prises dans l'ordre où les proies frappent (`UNITS`), d'abord les JSN. Les promotions sont lues unité par unité ; leur gain est l'attaque de l'unité promue moins celle d'avant. Sans vitesse de ponte, le temps de ponte est omis. Un nombre et son unité ne sont jamais coupés (« 1 921 JSN ») ; le nom complet des unités est dans l'infobulle de la cellule. Le texte du jeu est replié (masqué, pas supprimé) derrière « Voir le texte du jeu » ; ses contrôles (« Corbeille ») passent dans la barre d'outils, toujours visibles.
- **Prévision** : chaque combat est rejoué par le moteur (`src/game/army/combat.ts`). Armes déduites du rapport (bonus ÷ dégâts × 10), Bouclier et Étable à cochenilles mémorisés par `game-levels` (niveaux **actuels** : un combat antérieur à une montée de Bouclier peut dévier). Colonne « Prévu » à côté de « Pertes » : « 4, +1 blessée » (tuées prévues, blessées à plus de la moitié de leur vie, perdues mais absentes du rapport). Une note sous le tableau explique la colonne et le Bouclier utilisé : « Pertes (prévu avec Bouclier 6) » en en-tête n'était pas compris. Ligne colorée, et pertes précédées de « ⚠ » (lisible sans distinguer les couleurs), quand l'écart dépasse 1 fourmi **et** 20 % ; le total compte ces combats. Niveaux illisibles : « — » et une note « passez au Laboratoire ». Une unité ou une proie que le moteur ne connaît pas : « inconnu : X » plutôt qu'une prévision fausse. Les proies se reconnaissent sans tenir compte des accents : le jeu écrit « Lezards » dans les rapports (`preyIndexOf`).
- **Combats précédents** : le jeu n'affiche que les 10 derniers ; « Voir les combats précédents » clique sur son lien « Voir les messages précédents » et le tableau se met à jour.
- **Copier les combats** (« Copié ! » pendant 3 s) : une ligne par combat, au format de `src/game/army/__fixtures__/hunt-reports.ts` (`date|armée|proies|dégâts base+bonus|proies tuées|dégâts reçus|fourmis tuées|promues|cm²|nourriture`), sans pseudo.

## Code

| Fichier                                        | Rôle                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `src/features/hunt-reports/report.ts` (+ test) | Lecture des combats, prévision, ligne copiée, total     |
| `src/features/hunt-reports/mount.ts` (+ test)  | Tableau, texte du jeu replié, copie, combats précédents |
| `src/features/hunt-reports/index.ts`           | La feature : repère les conversations ouvertes          |
