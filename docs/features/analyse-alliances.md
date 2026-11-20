# Feature : Analyse des alliances

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-20, avec `analyse-joueurs.md`, `recrutement.md` et `site-analyse.md`. Sources : `../research/fourmizzz-api-exports.md` (diplomatie, `masterPlayerId`), `../research/combat.md` (portée).

## But

Juger une autre alliance face à la sienne : qui peut prendre qui, avec qui elle est liée, qui elle colonise et qui la colonise, qui la floode.

## Où

- **Jeu** : sur la page d'une alliance (`classementAlliance.php?alliance=TAG`), sous l'encart « Progression » des Statistiques d'alliance, quatre encarts repliables : Face-à-face, Bloc diplomatique, Colonies, Floods probables. Face-à-face seulement sur une autre alliance que la mienne ; les trois autres sur toute alliance, la mienne comprise.
- **Site** : la fiche alliance (`/[server]/alliances/[tag]`), mêmes sections. Face-à-face y a un champ « Face-à-face avec… » (tag), prérempli par l'alliance de mon Espace d'alliance quand je suis connecté.
- Données : dernier export (état courant de la base sur le site), TDC en direct de mon alliance dans le jeu (tableau Membres mémorisé, le mien dans l'en-tête).

## Face-à-face

- Portée : `inRange` (50 % inclus, 300 % exclu), dans les deux sens.
- **En tête**, pour chaque côté : le TDC exposé (somme des membres à portée d'au moins un adverse), le nombre de membres hors de toute portée, et la distance médiane entre les deux groupes (en cases).
- **Deux tableaux** : « Leurs membres » puis « Les nôtres ». Une ligne par membre : pseudo, TDC, nombre d'adverses qu'il peut prendre, le plus proche qu'il peut prendre (pseudo, cases). Dans le jeu, sur « Leurs membres », mon trajet vers lui (ma Vitesse d'attaque est la seule connue). Triables, par nombre d'adverses décroissant par défaut.
- Pas de matrice : à 60 × 60, illisible.
- Membres en vacances ou bannis : grisés, hors des totaux.

## Bloc diplomatique

- **Graphe** (ECharts) centré sur l'alliance : ses pactes directs sur un premier cercle, les pactes de ses alliés sur un second, plus pâle. Les guerres sont un autre trait, en pointillés, avec le mot « guerre » (déclarée, subie, réciproque, comme les Cibles) : jamais la seule couleur (ADR 0003).
- Pactes lus dans les deux sens, tags sans la casse, guerres contre soi-même ignorées (`../research/fourmizzz-api-exports.md`).
- **TDC du bloc** = l'alliance et ses pactes directs : « Avec ses 3 pactes, ce bloc pèse 41,2 M de TDC, 3,4 fois votre alliance. » (comparaison seulement quand j'ai une alliance).
- Dans le jeu : le graphe, la liste des pactes et guerres (tag, type de pacte, TDC, membres) et le total.

## Colonies

- Trois listes :
  1. **Membres colonisés par l'extérieur** : membre, maître, alliance du maître.
  2. **Colonies tenues hors de l'alliance** : maître (membre), colonie, alliance de la colonie.
  3. **Colonisations entre membres** : le nombre, dépliable.
- **Arbre** maître → colonie → colonie seulement quand une chaîne a plus d'un niveau.
- Sur la fiche joueur du site : son maître et ses colonies.

## Floods probables par alliance

Règle d'appariement : `site-analyse.md`.

- Tableau « Floods probables sur 7 j » : une ligne par alliance adverse, TDC pris, TDC perdu, solde, nombre de floods ; les floods sans alliance adverse sûre comptent dans « inconnu ». Triable, solde croissant par défaut (qui nous coûte le plus).
- Les floods entre deux membres sont à part, « Dans l'alliance » : c'est la Chaîne de TDC, pas une guerre.
- Pas de filtre « Floods » dans le Journal du serveur : des milliers de lignes par jour sur S2.
- Seulement quand le site répond ; sinon l'encart le dit.

## Interrupteur

Feature « Analyse des alliances » dans « Fonctionnalités », allumée par défaut, options « Face-à-face », « Bloc diplomatique », « Colonies », « Floods probables ».

## Fichiers prévus

| Fichier                                           | Rôle                                           |
| ------------------------------------------------- | ---------------------------------------------- |
| `packages/game/src/analysis/face-off.ts` (+ test) | Portées croisées, TDC exposé, distance médiane |
| `packages/game/src/analysis/bloc.ts` (+ test)     | Pactes sur deux cercles, guerres, TDC du bloc  |
| `packages/game/src/analysis/colonies.ts` (+ test) | Les trois listes et l'arbre                    |
| `apps/extension/src/features/alliance-analysis/`  | Encarts de la page d'alliance                  |
| `apps/web/src/components/alliance/`               | Sections de la fiche alliance                  |

## Ordre

Lot 2 : Face-à-face, Bloc, Colonies, dans le jeu puis sur le site. Floods probables au lot 3, après `site-analyse.md`.
