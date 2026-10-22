# Feature : Carte de l'alliance

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07.

## But

Aider une alliance à s'organiser : voir où sont les membres et qui est proche de qui (défense, convois). La chaîne de TDC n'est **pas** dans la feature : c'est un outil à part, `chaine-tdc.md`.

## Comportement

- **Accès** : entrée « Carte » ajoutée au menu d'alliance, après « Membres ». Lien `alliance.php?Membres#carte` partageable. La vue remplace le tableau des membres tant que le hash est `#carte`.
- **Données** : positions, grade, vacances, colonisation depuis l'API des exports (date affichée à l'heure de Paris : « positions du 07/10 à 0 h 00 »). TDC lu en direct sur la page Membres. Membres = joueurs de mon alliance dans l'export ; le filtre est isolé pour accepter d'autres tags plus tard.
- **Graphe** : nuage de points x/y à axes de même échelle : la zone de tracé est carrée (sa hauteur suit la largeur disponible, 640 px au plus), les bornes tombent sur des graduations rondes, et un axe ne descend pas sous 0 (les coordonnées du jeu sont positives) sauf d'un cran pour décoller un joueur de l'axe. Trait entre A et B si l'un est dans les **k plus proches** de l'autre (k = 3 par défaut, réglable). Pseudos toujours affichés, sans se chevaucher : chacun prend la première place libre autour de son point (à droite, à gauche, dessus, dessous, en biais ; `apps/extension/src/utils/map-chart/labels.ts`, partagé avec la Carte du serveur), calculée à la vue entière, donc encore libre en zoomant. Vacances grisées, colonisés préfixés par ⛓ ; ils comptent comme voisins.
- **Rôles de la chaîne** (quand « Chaîne de TDC » est allumée) : case « Couleurs des rôles de la chaîne », cochée par défaut. Chaque membre prend la couleur, la taille et la forme de bulle de son rôle (forme par type de rôle, pour les daltoniens), réglées dans la Chaîne (`chaine-tdc.md`) ; mêmes rôles que la Chaîne, proposés d'après le TDC tant qu'ils n'y sont pas choisis ; vacances et bannis hors chaîne. Le joueur sélectionné est alors cerclé et un peu plus gros (ses voisins gardent leurs traits en évidence), une légende liste les rôles présents et le survol donne le rôle. Les changements faits dans la Chaîne arrivent sans recharger la page. Décochée : l'affichage habituel.
- **Zoom** : Ctrl + molette autour du curseur (la molette seule fait défiler la page), glisser pour se déplacer, pincer sur trackpad ou mobile, bouton « Réinitialiser le zoom ». Double-clic sur un joueur : zoom sur lui et ses voisins. Points et textes gardent leur taille.
- **Interactions** : survol = pseudo, coordonnées, grade, TDC, distance et trajet depuis le joueur sélectionné. Clic = sélection (toi par défaut). Aucune action de jeu.
- **Tableau** : tous les membres triés par distance au joueur sélectionné, les k plus proches en évidence. Colonnes : pseudo (+ lien profil), distance (« 18,4 »), TDC, **« sélectionné → membre »** (niveau du sélectionné), **« membre → sélectionné »** (niveau du membre), Vitesse d'attaque modifiable (entier de 0 à 30 ; vide = le niveau utilisé, affiché en grisé).
- **Vitesse d'attaque** (voir `../research/temps-de-trajet.md`) :
  - la mienne est relue sur `laboratoire.php` à l'ouverture de la carte, par `game-levels` (même lecteur et même mémoire que les autres features) ;
  - niveau global = saisi à la main, sinon le mien ; il s'applique aux membres sans niveau connu, et ces temps sont marqués « ≈ » (estimation) ;
  - niveau par joueur saisi dans le tableau ;
  - quand « Partage d'alliance » est allumé, la Vitesse d'attaque que les membres ont partagée (`partage-alliance.md`) ; un niveau saisi dans le tableau l'emporte seulement s'il est plus récent que le relevé partagé (chaque saisie est datée ; une saisie d'avant cette version compte comme plus ancienne). L'ancien partage `Pseudo: niveau` de la Carte a disparu : ce format se colle désormais dans « Partage ».
- **Mémorisé par serveur** (`browser.storage.local`) : k, couleurs des rôles affichées ou non, niveau global, niveau Laboratoire, niveaux par joueur et leur date de saisie, dernier export.

## Hors v1

Alliés et ennemis sur la carte, actions de jeu, export image.

## Code

| Fichier                                                         | Rôle                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/extension/src/features/alliance-map/menu.ts`              | Entrée de menu (script léger, toutes les pages)                                                                                                       |
| `apps/extension/src/entrypoints/alliance-map.content/index.tsx` | Script dédié à `alliance.php` : monte la vue dans un Shadow DOM                                                                                       |
| `apps/extension/src/data/exports.ts`                            | Export des joueurs + cache par version (partagé)                                                                                                      |
| `packages/game/src/pages/alliance.ts`                           | Lecture de la page Membres et de l'en-tête (partagé)                                                                                                  |
| `neighbors.ts`                                                  | k plus proches, liens (distance : `packages/game/src/travel.ts`)                                                                                      |
| `neighbor-table.ts`                                             | Niveaux connus/estimés, trajets dans les deux sens                                                                                                    |
| `shared-levels.ts`                                              | Vitesse d'attaque partagée (« Partage »), pour Carte et Chaîne                                                                                        |
| `settings.ts`, `apps/extension/src/utils/export-date.ts`        | Réglages mémorisés, date de l'export                                                                                                                  |
| `chart-option.ts`, `MapChart.tsx`                               | Option ECharts, événements (axes, zone carrée, zoom et placement des noms : `apps/extension/src/utils/map-chart/`, partagés avec la Carte du serveur) |
| `AllianceMap.tsx`, `NeighborTable.tsx`                          | Vue React                                                                                                                                             |

Tests vitest aux interfaces : neighbors, `packages/game/src/travel.ts`, pages (fixtures), api (fetch simulé + fakeBrowser), neighbor-table, dates, bornes et zone carrée du graphe (`apps/extension/src/utils/map-chart/axes.ts`), vues d'alliance affichées selon les interrupteurs (`apps/extension/src/utils/alliance-views.ts`). La vue elle-même se vérifie dans le jeu.
