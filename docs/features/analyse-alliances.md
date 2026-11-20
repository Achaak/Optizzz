# Feature : Analyse des alliances

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-20, avec `analyse-joueurs.md`, `recrutement.md` et `site-analyse.md`. Sources : `../research/fourmizzz-api-exports.md` (diplomatie, `masterPlayerId`), `../research/combat.md` (portée).

## But

Juger une autre alliance face à la sienne : qui peut prendre qui, avec qui elle est liée, qui elle colonise et qui la colonise, qui la floode.

## Où

- **Jeu** : sur la page d'une alliance (`classementAlliance.php?alliance=TAG`), sous l'encart « Progression » des Statistiques d'alliance, quatre encarts repliables : Face-à-face, Bloc diplomatique, Colonies, Floods probables. Face-à-face seulement sur une autre alliance que la mienne ; les trois autres sur toute alliance, la mienne comprise.
- **Site** : la fiche alliance (`/[server]/alliances/[tag]`), mêmes sections, après le tableau des membres. Face-à-face y a un champ « Face-à-face avec… » (tag), prérempli par l'alliance de mon Espace d'alliance sur ce serveur quand je suis connecté. Pour que la fiche reste statique (reconstruite chaque heure), le champ lit la route `/api/[server]/alliances/[tag]/face-off?with=TAG` (gardée 10 minutes) ; le rapport avec « votre alliance » du Bloc n'est que dans le jeu.
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
- **Graphe** : `blocLayout`, partagé par le jeu et le site, dans une boîte de 640 × 420. Pactes directs sur la moitié haute d'un premier cercle, pactes des alliés sur un second cercle, répartis régulièrement dans l'ordre de l'allié d'où ils viennent (groupés près de lui, ils s'empilaient), guerres sur la moitié basse, sur deux rayons au-delà de 4. Au plus 8 alliances par cercle ; les autres ne sont que dans le tableau (« N autres alliances ne tiennent que dans le tableau »).

## Colonies

- Trois listes :
  1. **Membres colonisés par l'extérieur** : membre, maître, alliance du maître.
  2. **Colonies tenues hors de l'alliance** : maître (membre), colonie, alliance de la colonie.
  3. **Colonisations entre membres** : le nombre, dépliable.
- Chaque liste montre 10 lignes, puis « Voir les N autres » (une alliance de S2 tient 950 colonies hors de l'alliance, relevé du 2026-11-20).
- **Arbre** maître → colonie → colonie seulement quand une chaîne a plus d'un niveau. Sous le maître du haut, seules les colonies qui ont leurs propres colonies sont dessinées ; les autres sont comptées (« et 37 autres colonies directes »).
- Sur la fiche joueur du site : son maître et ses colonies.

## Floods probables par alliance

Règle d'appariement : `site-analyse.md`.

- Tableau « Floods probables sur 7 j » : une ligne par alliance adverse, TDC pris, TDC perdu, solde, nombre de floods ; les floods sans alliance adverse sûre comptent dans « inconnu ». Triable, solde croissant par défaut (qui nous coûte le plus).
- Les floods entre deux membres sont à part, « Dans l'alliance » : c'est la Chaîne de TDC, pas une guerre.
- Pas de filtre « Floods » dans le Journal du serveur : des milliers de lignes par jour sur S2.
- Seulement quand le site répond ; sinon l'encart le dit.

## Interrupteur

Feature « Analyse des alliances » dans « Fonctionnalités », allumée par défaut, options « Face-à-face », « Bloc diplomatique », « Colonies », « Floods probables ».

## Fichiers

| Fichier                                                                 | Rôle                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/game/src/analysis/face-off.ts` (+ test)                       | Portées croisées, TDC exposé, distance médiane             |
| `packages/game/src/analysis/bloc.ts` (+ test)                           | Pactes sur deux cercles, guerres, TDC du bloc, son graphe  |
| `packages/game/src/analysis/colonies.ts` (+ test)                       | Les trois listes et les chaînes                            |
| `apps/extension/src/features/alliance-analysis/`                        | Encarts de la page d'alliance, montés par `alliance-stats` |
| `apps/web/src/components/alliance/`                                     | Sections de la fiche alliance                              |
| `apps/web/src/app/api/[server]/alliances/[tag]/face-off/route.ts`       | Le face-à-face lu par le champ de la fiche                 |
| `apps/web/src/server/queries.ts` (`allianceAnalysis`, `faceOffMembers`) | Alliances, colonies et membres lus dans la base            |

## Ordre

Lot 2 (fait le 2026-11-20) : Face-à-face, Bloc, Colonies, dans le jeu puis sur le site. Lot 3 (fait le 2026-11-20) : Floods probables, sur la fiche du site et, lus sur `/api/[server]/alliances/[tag]/floods`, dans le jeu (option « Floods probables par alliance » ; la requête dit quelle page d'alliance est ouverte, comme le disent `PRIVACY.md` et la fiche du store).
