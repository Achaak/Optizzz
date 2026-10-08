# Feature : Carte de l'alliance

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07.

## But

Aider une alliance à s'organiser : voir où sont les membres et qui est proche de qui (défense, renforts, convois). La chaîne de TDC n'est **pas** dans la feature : c'est un outil à part, `chaine-tdc.md`.

## Comportement

- **Accès** : entrée « Carte » ajoutée au menu d'alliance, après « Membres ». Lien `alliance.php?Membres#carte` partageable. La vue remplace le tableau des membres tant que le hash est `#carte`.
- **Données** : positions, grade, vacances, colonisation depuis l'API des exports (date affichée : « positions du 07/10 à 00h00 »). TDC lu en direct sur la page Membres. Membres = joueurs de mon alliance dans l'export ; le filtre est isolé pour accepter d'autres tags plus tard.
- **Graphe** : nuage de points x/y à axes de même échelle. Trait entre A et B si l'un est dans les **k plus proches** de l'autre (k = 3 par défaut, réglable). Pseudos toujours affichés. Vacances grisées, colonisés préfixés par ⛓ ; ils comptent comme voisins.
- **Zoom** : molette autour du curseur, glisser pour se déplacer, pincer sur mobile, bouton « Réinitialiser le zoom ». Double-clic sur un joueur : zoom sur lui et ses voisins. Points et textes gardent leur taille.
- **Interactions** : survol = pseudo, coordonnées, grade, TDC, distance et trajet depuis le joueur sélectionné. Clic = sélection (toi par défaut). Aucune action de jeu.
- **Tableau** : tous les membres triés par distance au joueur sélectionné, les k plus proches en évidence. Colonnes : pseudo (+ lien profil), distance, TDC, **Aller** (niveau du sélectionné), **Retour** (niveau du membre), Vitesse d'attaque modifiable.
- **Vitesse d'attaque** (voir `../research/temps-de-trajet.md`) :
  - la mienne est lue sur `laboratoire.php` à l'ouverture de la carte ;
  - niveau global = saisi à la main, sinon le mien ; il s'applique aux membres sans niveau connu, et ces temps sont marqués `*` (estimation) ;
  - niveau par joueur saisi dans le tableau ;
  - partage par copier-coller : une ligne `Pseudo: niveau` par membre (export → presse-papiers, import → retrouve les membres par pseudo, signale les lignes ignorées).
- **Mémorisé par serveur** (`browser.storage.local`) : k, niveau global, niveau Laboratoire, niveaux par joueur, dernier export.

## Hors v1

Rôles de chaîne (chasseur / passeur / grenier), alliés et ennemis sur la carte, actions de jeu, export image.

## Code

| Fichier                                                    | Rôle                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `src/features/alliance-map/menu.ts`                        | Entrée de menu (script léger, toutes les pages)                 |
| `src/entrypoints/alliance-map.content/index.tsx`           | Script dédié à `alliance.php` : monte la vue dans un Shadow DOM |
| `api.ts`                                                   | Export des joueurs + cache par version                          |
| `pages.ts`                                                 | Lecture des pages Membres, Laboratoire, en-tête                 |
| `neighbors.ts`                                             | Distances, k plus proches, liens                                |
| `neighbor-table.ts`                                        | Niveaux connus/estimés, lignes Aller/Retour                     |
| `travel.ts`                                                | Formule du temps de trajet, format des durées                   |
| `level-sharing.ts`                                         | Export / import texte des niveaux                               |
| `settings.ts`, `dates.ts`                                  | Réglages mémorisés, date de l'export                            |
| `chart-option.ts`, `MapChart.tsx`                          | Option ECharts, zoom, événements                                |
| `AllianceMap.tsx`, `NeighborTable.tsx`, `LevelSharing.tsx` | Vue React                                                       |

Tests vitest aux interfaces : neighbors, travel, pages (fixtures), level-sharing, api (fetch simulé + fakeBrowser), neighbor-table, dates. La vue elle-même se vérifie dans le jeu.
