# Outil du site : coûts et temps de développement

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Données : `packages/game/src/level-costs.ts` et `../research/couts-des-niveaux.md` (ticket 07).

## Adresse

`/tools/costs`. État dans `#p=` : élément, niveau de départ, niveau d'arrivée, niveau du bonus.

## Saisie

- **Élément** : une liste groupée « Bâtiments » / « Recherches », noms du jeu (`levels.ts`).
- **Niveau actuel** (0 ou plus) et **niveau visé** (au-dessus).
- **Bonus de durée** : le niveau d'**Architecture** pour un bâtiment, de la **Salle d'analyse** pour une recherche ; le bon champ s'affiche selon l'élément, pré-rempli avec « Mes niveaux ». Ce sont les seuls bonus.

## Résultat

- **Total** du niveau actuel au niveau visé : nourriture, matériaux, ouvrières (seulement ce que l'élément coûte : un bâtiment ne coûte que des matériaux), écrits comme le jeu (`formatNumber`) ; durée totale, écrite comme Optizzz (`time-format`).
- **Détail par niveau** : niveau, coût, durée, cumul du coût et de la durée.
- Durée d'un niveau avec bonus : durée hors bonus × 0,9^niveau du bonus, arrondie à la seconde **pour chaque niveau**, comme le jeu ; le total additionne les niveaux arrondis. Les paliers de durée sont ceux de la table ; une note rappelle que × 1,2 et × 1,12 ne sont pas encore vérifiés dans le jeu.
- Le bonus suppose que son niveau ne change pas pendant les chantiers (une note le dit).

## Hors 2b

Prérequis (« Requis : Laboratoire N »), temps de ponte des ouvrières d'une recherche, plusieurs éléments à la fois.

## Doit

- Tester les bonus avec vitest (durée d'un niveau relevé dans le jeu, bonus compris : voir `couts-des-niveaux.md`).
- Marcher en clair, en sombre et sur téléphone (le détail défile horizontalement s'il le faut).
