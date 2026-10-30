# Outil du site : coûts et temps de développement

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Données : `packages/game/src/level-costs.ts` et `../research/couts-des-niveaux.md` (ticket 07).

## Adresse

`/tools/costs`. État dans `#p=` : élément, niveau de départ, niveau d'arrivée, niveaux des deux bonus (Architecture et Salle d'analyse : voir « Code »).

## Saisie

- **Élément** : une liste groupée « Bâtiments » / « Recherches », noms du jeu (`levels.ts`).
- **Niveau actuel** (0 ou plus) et **niveau visé** (au-dessus).
- **Bonus de durée** : le niveau d'**Architecture** pour un bâtiment, de la **Salle d'analyse** pour une recherche ; le bon champ s'affiche selon l'élément, pré-rempli avec « Mes niveaux ». Ce sont les seuls bonus.

## Résultat

- **Total** du niveau actuel au niveau visé : nourriture, matériaux, ouvrières (seulement ce que l'élément coûte : un bâtiment ne coûte que des matériaux), écrits comme le jeu (`formatNumber`) ; durée totale, écrite comme Optizzz (`time-format`).
- **Détail par niveau** : niveau, coût, durée, cumul du coût (la durée totale est en tête du Rapport, depuis le 2026-10-30, `site-refonte.md`).
- Durée d'un niveau avec bonus : durée hors bonus × 0,9^niveau du bonus, arrondie à la seconde **pour chaque niveau**, comme le jeu ; le total additionne les niveaux arrondis. Les paliers de durée sont ceux de la table ; une note rappelle que × 1,2 et × 1,12 ne sont pas encore vérifiés dans le jeu.
- Le bonus suppose que son niveau ne change pas pendant les chantiers (une note le dit).

## Hors 2b

Prérequis (« Requis : Laboratoire N »), temps de ponte des ouvrières d'une recherche, plusieurs éléments à la fois.

## Doit

- Tester les bonus avec vitest (durée d'un niveau relevé dans le jeu, bonus compris : voir `couts-des-niveaux.md`).
- Marcher en clair, en sombre et sur téléphone (le détail défile horizontalement s'il le faut).

## Code

Fait le 2026-10-23 (ticket 08).

| Fichier                                                       | Rôle                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/tools/costs/page.tsx`                       | La page `/tools/costs` (gabarit `ToolPage`)                                                                                                                                                                                     |
| `apps/web/src/components/tools/costs/costs-tool.tsx`          | Saisie, total et détail par niveau ; « Copier le lien », « Reprendre mes niveaux »                                                                                                                                              |
| `apps/web/src/components/tools/costs/development.ts` (+ test) | `levelSeconds` (durée d'un niveau avec bonus, arrondie à la seconde), `developmentPlan` (niveaux, cumuls, total), `bonusKeyOf`, `costedResources` ; croissances de `level-costs.ts`, bonus de `speed-up.ts` (`SPEED_UP_FACTOR`) |
| `apps/web/src/components/tools/costs/costs-state.ts` (+ test) | Format de l'adresse (`defineLinkFormat`, version 1)                                                                                                                                                                             |

Décisions prises en codant :

- L'état garde **les deux** bonus (`a` : Architecture, `s` : Salle d'analyse), pas un seul : passer d'un bâtiment à une recherche garde chacun, et « Mes niveaux » pré-remplit et retient les deux comme les autres outils. Seul celui de l'élément choisi s'affiche et compte. Adresse : `{ e, f, t, a, s }` (élément, niveau actuel, niveau visé, bonus).
- Ouvert sans lien ni état gardé : Champignonnière, du niveau 0 au niveau 10. Niveaux de 0 à 60 (au-delà des 50 de Toolzzz). Un champ de bonus vide compte pour 0.
- Durées écrites comme le jeu les montre sur ses chantiers (`formatGameDuration` : « 21H 26m 24s », « 7J 10H 21m 43s »), à la seconde : `formatDuration` arrondit à la minute et s'arrête à 30 jours, trop court pour les hauts niveaux.
- La note sur × 1,2 et × 1,12 ne s'affiche que si le niveau visé atteint le premier de ces paliers pour l'élément.
- Le choix de l'élément est une liste native (`<select>` avec `<optgroup>` « Bâtiments » / « Recherches »), comme le champ Serveur du socle : pas de composant shadcn ajouté.
